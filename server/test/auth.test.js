import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: 'test-only-secret-'.repeat(4),
});
const db = new PrismaClient();
const origin = config.CLIENT_ORIGIN;
const account = { name: 'Naveen', email: 'student@example.com', password: 'strong password 123' };
let app;
let agent;
let token;
const mutate = (method, url, body) =>
  agent[method](url).set('Origin', origin).set('X-CSRF-Token', token).send(body);
beforeAll(async () => {
  app = await createApp({ db, config, generalLimit: 1000, authLimit: 1000 });
});
beforeEach(async () => {
  await db.user.deleteMany();
  agent = request.agent(app);
  token = (await agent.get('/api/auth/csrf').expect(200)).body.data.csrfToken;
});
afterAll(async () => {
  await db.$disconnect();
});

describe('authentication integration', () => {
  it('registers, normalizes email, hashes password and sets a private cookie', async () => {
    const result = await mutate('post', '/api/auth/register', {
      ...account,
      email: ' Student@Example.COM ',
    }).expect(201);
    expect(result.body.data.user.email).toBe(account.email);
    expect(result.body.data.user).not.toHaveProperty('passwordHash');
    expect(result.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(result.headers['set-cookie'][0]).toContain('SameSite=Lax');
    const stored = await db.user.findUnique({ where: { email: account.email } });
    expect(stored.passwordHash).not.toBe(account.password);
    expect(await bcrypt.compare(account.password, stored.passwordHash)).toBe(true);
    expect(bcrypt.getRounds(stored.passwordHash)).toBe(12);
    await agent.get('/api/auth/me').expect(200);
  });
  it('logs out, denies private access and permits a subsequent login', async () => {
    await mutate('post', '/api/auth/register', account).expect(201);
    await mutate('post', '/api/auth/logout', {}).expect(200);
    await agent.get('/api/auth/me').expect(401);
    await mutate('post', '/api/auth/login', {
      email: account.email,
      password: account.password,
    }).expect(200);
    await agent.get('/api/auth/me').expect(200);
  });
  it('rejects duplicate emails with a consistent error', async () => {
    await mutate('post', '/api/auth/register', account).expect(201);
    const response = await mutate('post', '/api/auth/register', account).expect(409);
    expect(response.body.error.code).toBe('EMAIL_EXISTS');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });
  it('uses the same credentials error for absent users and wrong passwords', async () => {
    const absent = await mutate('post', '/api/auth/login', {
      email: account.email,
      password: 'wrong',
    }).expect(401);
    await mutate('post', '/api/auth/register', account).expect(201);
    const wrong = await mutate('post', '/api/auth/login', {
      email: account.email,
      password: 'wrong',
    }).expect(401);
    expect(absent.body.error.message).toBe(wrong.body.error.message);
  });
  it.each([
    { ...account, email: 'bad' },
    { ...account, password: 'short' },
    { ...account, password: '😀'.repeat(19) },
    { ...account, timeZone: 'Mars/Base' },
    { ...account, role: 'admin' },
  ])('rejects invalid registration %#', async (body) => {
    const result = await mutate('post', '/api/auth/register', body).expect(400);
    expect(result.body.error.code).toBe('VALIDATION_ERROR');
    expect(await db.user.count()).toBe(0);
  });
  it('requires both a trusted origin and valid signed double-submit token', async () => {
    await agent.post('/api/auth/register').set('Origin', origin).send(account).expect(403);
    await agent
      .post('/api/auth/register')
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', token)
      .send(account)
      .expect(403);
    await agent.post('/api/auth/register').set('X-CSRF-Token', token).send(account).expect(403);
    const forged = `${'a'.repeat(64)}.${'b'.repeat(64)}`;
    await request(app)
      .post('/api/auth/register')
      .set('Origin', origin)
      .set('Cookie', `algolens_csrf=${forged}`)
      .set('X-CSRF-Token', forged)
      .send(account)
      .expect(403);
  });
  it('rejects missing, tampered, expired and wrong-audience JWTs', async () => {
    await agent.get('/api/auth/me').expect(401);
    for (const token of [
      'invalid',
      jwt.sign({}, config.JWT_SECRET, {
        subject: 'x',
        expiresIn: -1,
        issuer: 'algolens-api',
        audience: 'algolens-client',
      }),
      jwt.sign({}, config.JWT_SECRET, { subject: 'x', issuer: 'algolens-api', audience: 'other' }),
    ]) {
      await request(app).get('/api/auth/me').set('Cookie', `algolens_session=${token}`).expect(401);
    }
  });
  it('rejects a valid token after its user is deleted', async () => {
    await mutate('post', '/api/auth/register', account).expect(201);
    await db.user.deleteMany();
    await agent.get('/api/auth/me').expect(401);
  });
  it('updates only permitted profile fields', async () => {
    await mutate('post', '/api/auth/register', account).expect(201);
    const response = await mutate('patch', '/api/auth/me', {
      name: 'Student',
      timeZone: 'UTC',
    }).expect(200);
    expect(response.body.data.user.timeZone).toBe('UTC');
    await mutate('patch', '/api/auth/me', { passwordHash: 'overwrite' }).expect(400);
    await mutate('patch', '/api/auth/me', {}).expect(400);
  });
  it('returns safe JSON errors for malformed bodies, oversized bodies and unknown routes', async () => {
    const malformed = await agent
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    expect(malformed.body.error.code).toBe('INVALID_JSON');
    await agent
      .post('/api/auth/login')
      .send({ value: 'x'.repeat(270000) })
      .expect(413);
    const missing = await agent.get('/api/missing').expect(404);
    expect(missing.body.error).not.toHaveProperty('stack');
  });
  it('reports database readiness and sets security/CORS headers', async () => {
    const result = await agent.get('/api/health').set('Origin', origin).expect(200);
    expect(result.body.data.status).toBe('ok');
    expect(result.headers['access-control-allow-origin']).toBe(origin);
    expect(result.headers['x-content-type-options']).toBe('nosniff');
    expect(result.headers['cache-control']).toBe('no-store');
    const other = await agent.get('/api/health').set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });
  it('enforces the authentication rate limit', async () => {
    const limited = await createApp({ db, config, authLimit: 1 });
    const client = request.agent(limited);
    const csrf = (await client.get('/api/auth/csrf')).body.data.csrfToken;
    for (const status of [401, 429]) {
      await client
        .post('/api/auth/login')
        .set('Origin', origin)
        .set('X-CSRF-Token', csrf)
        .send({ email: account.email, password: 'wrong' })
        .expect(status);
    }
  });
  it('requires secure production configuration', () => {
    expect(() =>
      loadConfig({ ...config, NODE_ENV: 'production', COOKIE_SECURE: 'false' }),
    ).toThrow();
    expect(() => loadConfig({ ...config, JWT_SECRET: 'short' })).toThrow();
  });
});
