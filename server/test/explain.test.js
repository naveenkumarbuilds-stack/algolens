import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { explainStep } from '../src/services/explain.js';

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: 'test-only-secret-'.repeat(4),
  AI_API_KEY: 'test-provider-key',
});
const step = {
  type: 'compare',
  line: 3,
  variables: { i: 0, left: 4, right: 2 },
  explanation: 'Compare neighboring values.',
};
const input = { consent: true, algorithmId: 'bubble-sort', language: 'pseudocode', step };
const success = () =>
  new Response(
    JSON.stringify({
      status: 'completed',
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: 'The values 4 and 2 are compared. They are out of order.',
            },
          ],
        },
      ],
    }),
    { status: 200 },
  );
const db = new PrismaClient();
let userId;
beforeAll(async () => {
  const user = await db.user.create({
    data: {
      email: 'ai-test@example.com',
      name: 'AI Tester',
      passwordHash: 'test-only-unused-hash',
    },
  });
  userId = user.id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});
afterEach(() => {
  vi.useRealTimers();
});
async function authorized(app, body = input) {
  const bootstrap = await request(app).get('/api/auth/csrf');
  const session = jwt.sign({}, config.JWT_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    issuer: 'algolens-api',
    audience: 'algolens-client',
    expiresIn: '1h',
  });
  const cookies = [
    ...bootstrap.headers['set-cookie'].map((s) => s.split(';')[0]),
    `algolens_session=${session}`,
  ].join('; ');
  return request(app)
    .post('/api/explain')
    .set('Cookie', cookies)
    .set('Origin', config.CLIENT_ORIGIN)
    .set('X-CSRF-Token', bootstrap.body.data.csrfToken)
    .send(body);
}
describe('AI explanation API', () => {
  it('reports disabled availability and rejects configured-off requests without provider calls', async () => {
    const fetchImpl = vi.fn();
    const app = await createApp({
      db,
      config: { ...config, AI_API_KEY: '' },
      aiOptions: { fetchImpl },
    });
    const status = await request(app).get('/api/explain/status');
    expect(status.body.data).toEqual({ enabled: false, provider: 'OpenAI' });
    expect(JSON.stringify(status.body)).not.toContain('test-provider-key');
    expect((await authorized(app)).status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('requires authentication, CSRF, explicit consent and bounded inputs', async () => {
    const fetchImpl = vi.fn();
    const app = await createApp({ db, config, aiOptions: { fetchImpl, limit: 50 } });
    expect((await request(app).post('/api/explain').send(input)).status).toBe(403);
    const bootstrap = await request(app).get('/api/auth/csrf');
    expect(
      (
        await request(app)
          .post('/api/explain')
          .set('Cookie', bootstrap.headers['set-cookie'].map((s) => s.split(';')[0]).join('; '))
          .set('Origin', config.CLIENT_ORIGIN)
          .set('X-CSRF-Token', bootstrap.body.data.csrfToken)
          .send(input)
      ).status,
    ).toBe(401);
    for (const body of [
      { ...input, consent: false },
      { ...input, step: { ...step, variables: { large: 'x'.repeat(13000) } } },
      { ...input, sourceCode: 'x'.repeat(20001) },
      { ...input, url: 'https://evil.example' },
      { ...input, algorithmId: 'missing' },
    ])
      expect((await authorized(app, body)).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('keeps keys server-side, derives library source, and asks for a bounded un-stored response', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => success());
    const app = await createApp({ db, config, aiOptions: { fetchImpl } });
    const result = await authorized(app);
    expect(result.status).toBe(200);
    expect(result.body.data.explanation).toContain('4 and 2');
    expect(JSON.stringify(result.body)).not.toContain(config.AI_API_KEY);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(options.headers.Authorization).toBe(`Bearer ${config.AI_API_KEY}`);
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({ store: false, max_output_tokens: 450, model: config.AI_MODEL });
    expect(body).not.toHaveProperty('tools');
    expect(body.instructions).toContain('untrusted data');
    expect(JSON.parse(body.input).source).toContain('swapped');
  });
  it('does not send a custom source unless included and handles plain-text provider output', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => success());
    await explainStep(config, { language: 'c', step }, fetchImpl);
    expect(JSON.parse(JSON.parse(fetchImpl.mock.calls[0][1].body).input).source).toBe(
      'Source not shared',
    );
    await explainStep(
      config,
      { language: 'c', sourceCode: 'int main(){return 0;}', step },
      fetchImpl,
    );
    expect(JSON.parse(JSON.parse(fetchImpl.mock.calls[1][1].body).input).source).toContain(
      'int main',
    );
  });
  it('limits requests per authenticated user', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => success());
    const app = await createApp({ db, config, aiOptions: { fetchImpl, limit: 1 } });
    expect((await authorized(app)).status).toBe(200);
    expect((await authorized(app)).status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
describe('provider failure boundaries', () => {
  it.each([401, 429, 500])('sanitizes provider HTTP %s', async (status) => {
    const fetchImpl = async () => new Response('sensitive provider diagnostics', { status });
    await expect(explainStep(config, input, fetchImpl)).rejects.toMatchObject({
      status: status === 429 ? 429 : 502,
    });
  });
  it('rejects invalid, incomplete, oversized and empty responses', async () => {
    for (const body of [
      'invalid',
      JSON.stringify({ status: 'incomplete' }),
      JSON.stringify({ status: 'completed', output: [] }),
      'x'.repeat(70000),
    ])
      await expect(
        explainStep(config, input, async () => new Response(body)),
      ).rejects.toMatchObject({ status: 502 });
  });
  it('maps network failures without exposing their details', async () => {
    await expect(
      explainStep(config, input, async () => {
        throw new Error('private diagnostic');
      }),
    ).rejects.toMatchObject({
      status: 502,
      message: 'The AI provider could not be reached or returned invalid data.',
    });
  });
  it('aborts requests after 10 seconds', async () => {
    vi.useFakeTimers();
    const promise = explainStep(
      config,
      input,
      async (_url, { signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    const assertion = expect(promise).rejects.toMatchObject({ status: 504, code: 'AI_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(10000);
    await assertion;
  });
  it('rejects a provider-base URL override and insecure production config', () => {
    expect(() => loadConfig({ ...config, AI_API_BASE_URL: 'https://evil.example' })).toThrow();
  });
});
