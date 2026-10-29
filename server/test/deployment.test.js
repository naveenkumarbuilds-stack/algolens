import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createProxy } from '../../api/[...path].js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { readFileSync } from 'node:fs';
import { summarizePractice } from '../src/services/practice.js';

const secret = 'deployment-test-proxy-secret-'.repeat(3);
const env = { BACKEND_ORIGIN: 'https://backend.example.com', PROXY_SECRET: secret };
function response() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(value) {
      this.body = value?.toString();
    },
  };
}
const req = (extra = {}) => ({
  method: 'POST',
  url: '/api/auth/login',
  headers: {
    'x-vercel-forwarded-for': '203.0.113.4',
    origin: 'https://app.example.com',
    cookie: 'algolens_csrf=token',
    'content-type': 'application/json',
    'x-csrf-token': 'token',
    'x-algolens-proxy-token': 'forged',
    'x-algolens-client-ip': 'evil',
  },
  body: { email: 'user@example.com', password: 'local-test-password' },
  ...extra,
});
describe('production API proxy', () => {
  it('forwards cookies, CSRF and original origin; sets trusted credentials instead of client-supplied headers', async () => {
    const headers = new Headers({ 'content-type': 'application/json' });
    headers.append(
      'set-cookie',
      '__Host-algolens_session=one; Path=/; HttpOnly; Secure; SameSite=Lax',
    );
    headers.append(
      'set-cookie',
      '__Host-algolens_csrf=two; Path=/; HttpOnly; Secure; SameSite=Lax',
    );
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('{"data":{"ok":true}}', { status: 201, headers }));
    const res = response();
    await createProxy(env, fetchImpl)(req(), res);
    expect(res.statusCode).toBe(201);
    expect(res.headers['set-cookie']).toHaveLength(2);
    expect(res.headers['cache-control']).toBe('no-store');
    const [url, options] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe('https://backend.example.com/api/auth/login');
    expect(options.redirect).toBe('error');
    expect(options.headers).toMatchObject({
      origin: 'https://app.example.com',
      'x-csrf-token': 'token',
      'x-algolens-proxy-token': secret,
      'x-algolens-client-ip': '203.0.113.4',
    });
    expect(options.headers).not.toHaveProperty('authorization');
    expect(JSON.parse(options.body).email).toBe('user@example.com');
  });
  it('preserves query strings and backend JSON errors without HTML fallback', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('{"error":{"code":"NOT_FOUND"}}', {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const res = response();
    await createProxy(env, fetchImpl)(
      req({ method: 'GET', url: '/api/problems?page=2', body: undefined }),
      res,
    );
    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      'https://backend.example.com/api/problems?page=2',
    );
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('NOT_FOUND');
  });
  it('rejects bad configuration, non-API paths, spoofed IPs and oversized bodies before fetching', async () => {
    const fetchImpl = vi.fn();
    for (const [config, input, status] of [
      [{ ...env, BACKEND_ORIGIN: 'http://example.com' }, req(), 503],
      [env, req({ url: '/api/../private' }), 404],
      [env, req({ headers: { 'x-vercel-forwarded-for': 'bad' } }), 503],
      [env, req({ body: 'x'.repeat(262145) }), 413],
    ]) {
      const res = response();
      await createProxy(config, fetchImpl)(input, res);
      expect(res.statusCode).toBe(status);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('does not leak backend failures or proxy secrets', async () => {
    const res = response();
    await createProxy(env, async () => {
      throw new Error(secret);
    })(req(), res);
    expect(res.statusCode).toBe(502);
    expect(res.body).not.toContain(secret);
  });
});
describe('backend deployment protections', () => {
  const base = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'file:./test.db',
    JWT_SECRET: 'test-only-secret-'.repeat(4),
  });
  const fakeDb = { $queryRaw: async () => [{ value: 1 }] };
  it('requires the proxy secret and validates the forwarded client IP, while health checks remain public', async () => {
    const app = await createApp({ db: fakeDb, config: { ...base, PROXY_SECRET: secret } });
    await request(app).get('/api/explain/status').expect(403);
    await request(app)
      .get('/api/explain/status')
      .set('x-algolens-proxy-token', 'wrong')
      .expect(403);
    await request(app)
      .get('/api/explain/status')
      .set('x-algolens-proxy-token', secret)
      .set('x-algolens-client-ip', 'bad')
      .expect(400);
    await request(app)
      .get('/api/explain/status')
      .set('x-algolens-proxy-token', secret)
      .set('x-algolens-client-ip', '203.0.113.4')
      .expect(200);
    await request(app).get('/api/health').expect(200);
  });
  it('separates rate limits by authenticated proxy-provided IP', async () => {
    const app = await createApp({
      db: fakeDb,
      config: { ...base, PROXY_SECRET: secret },
      generalLimit: 1,
    });
    for (const [ip, status] of [
      ['203.0.113.4', 200],
      ['203.0.113.4', 429],
      ['203.0.113.5', 200],
    ])
      await request(app)
        .get('/api/explain/status')
        .set('x-algolens-proxy-token', secret)
        .set('x-algolens-client-ip', ip)
        .expect(status);
    await request(app).get('/api/health').expect(200);
  });
  it('rejects insecure or SQLite production configuration', () => {
    expect(() =>
      loadConfig({
        ...base,
        NODE_ENV: 'production',
        CLIENT_ORIGIN: 'https://app.example.com',
        COOKIE_SECURE: 'true',
        PROXY_SECRET: secret,
      }),
    ).toThrow(/PostgreSQL/);
    expect(() =>
      loadConfig({
        ...base,
        NODE_ENV: 'production',
        CLIENT_ORIGIN: 'https://app.example.com',
        COOKIE_SECURE: 'true',
        DATABASE_URL: 'postgresql://localhost/prod',
      }),
    ).toThrow(/PROXY_SECRET/);
  });
  it('keeps PostgreSQL and SQLite model definitions identical', () => {
    const sqlite = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
    const postgres = readFileSync(
      new URL('../prisma-postgres/schema.prisma', import.meta.url),
      'utf8',
    );
    expect(sqlite.slice(sqlite.indexOf('model User'))).toBe(
      postgres.slice(postgres.indexOf('model User')),
    );
    expect(summarizePractice([], '2026-10-30').currentStreak).toBe(0);
  });
});
