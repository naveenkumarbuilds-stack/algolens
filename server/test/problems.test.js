import crypto from 'node:crypto';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { localDate, offsetDay, summarizePractice } from '../src/services/practice.js';

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: 'test-only-secret-'.repeat(4),
});
const db = new PrismaClient();
let app, a, b;
const problem = {
  title: 'Sort practice',
  mode: 'library',
  algorithmId: 'bubble-sort',
  input: { values: [3, 1, 2] },
  tags: ['Arrays', 'arrays'],
  notes: 'Compare neighbors.',
};
async function user(email) {
  const agent = request.agent(app);
  const token = (await agent.get('/api/auth/csrf')).body.data.csrfToken;
  const send = (method, path, body) =>
    agent[method](path).set('Origin', config.CLIENT_ORIGIN).set('X-CSRF-Token', token).send(body);
  await send('post', '/api/auth/register', {
    name: 'Student',
    email,
    password: 'practice password 123',
  }).expect(201);
  return { agent, send };
}
beforeAll(async () => {
  app = await createApp({ db, config, generalLimit: 10000, authLimit: 10000 });
});
beforeEach(async () => {
  await db.user.deleteMany();
  a = await user('a@example.com');
  b = await user('b@example.com');
});
afterAll(async () => db.$disconnect());
describe('saved problems and practice', () => {
  it('saves, filters, edits and reopens parsed problems while preserving unchanged fields', async () => {
    const saved = (await a.send('post', '/api/problems', problem).expect(201)).body.data.problem;
    expect(saved.tags).toEqual(['arrays']);
    expect(saved.input).toEqual(problem.input);
    expect(saved).not.toHaveProperty('inputJson');
    const updated = (
      await a.send('patch', `/api/problems/${saved.id}`, { notes: 'new note' }).expect(200)
    ).body.data.problem;
    expect(updated.title).toBe(problem.title);
    expect(updated.tags).toEqual(['arrays']);
    expect(updated.status).toBe('revisit');
    expect(
      (await a.agent.get('/api/problems?tag=arrays&q=Sort&status=revisit').expect(200)).body.data
        .total,
    ).toBe(1);
    expect((await a.agent.get('/api/problems?tag=array').expect(200)).body.data.total).toBe(0);
    expect(
      (await a.agent.get(`/api/problems/${saved.id}`).expect(200)).body.data.problem.notes,
    ).toBe('new note');
  });
  it('never exposes another user’s problem or permits modifying it', async () => {
    const saved = (await a.send('post', '/api/problems', problem)).body.data.problem;
    await b.agent.get(`/api/problems/${saved.id}`).expect(404);
    await b.send('patch', `/api/problems/${saved.id}`, { notes: 'stolen' }).expect(404);
    await b.send('delete', `/api/problems/${saved.id}`).expect(404);
    await b
      .send('post', '/api/practice', { eventId: crypto.randomUUID(), savedProblemId: saved.id })
      .expect(404);
    expect((await b.agent.get('/api/problems')).body.data.total).toBe(0);
  });
  it('persists custom source, language, visual variable and input without executing source', async () => {
    const custom = {
      title: 'C practice',
      mode: 'custom',
      language: 'c',
      sourceCode: 'int main(){return 0;}',
      visualVariable: 'arr',
      input: { n: 4 },
    };
    const saved = (await a.send('post', '/api/problems', custom).expect(201)).body.data.problem;
    expect(saved).toMatchObject(custom);
    expect(saved.algorithmId).toBe(null);
  });
  it('records solved transitions atomically, without double-counting repeated solved updates', async () => {
    const saved = (await a.send('post', '/api/problems', problem)).body.data.problem;
    await a.send('patch', `/api/problems/${saved.id}`, { status: 'solved' }).expect(200);
    await a.send('patch', `/api/problems/${saved.id}`, { status: 'solved' }).expect(200);
    await a.send('patch', `/api/problems/${saved.id}`, { notes: 'still solved' }).expect(200);
    const summary = (await a.agent.get('/api/practice/summary')).body.data;
    expect(summary).toMatchObject({
      totalPractices: 1,
      currentStreak: 1,
      longestStreak: 1,
      totalProblems: 1,
      solvedProblems: 1,
    });
    await a.send('patch', `/api/problems/${saved.id}`, { status: 'revisit' });
    await a.send('patch', `/api/problems/${saved.id}`, { status: 'solved' });
    expect((await a.agent.get('/api/practice/summary')).body.data.totalPractices).toBe(2);
  });
  it('records a problem initially saved as solved and retains history after deletion', async () => {
    const saved = (await a.send('post', '/api/problems', { ...problem, status: 'solved' })).body
      .data.problem;
    await a.send('delete', `/api/problems/${saved.id}`).expect(200);
    const summary = (await a.agent.get('/api/practice/summary')).body.data;
    expect(summary).toMatchObject({ totalPractices: 1, totalProblems: 0 });
    expect((await db.practiceLog.findFirst()).savedProblemId).toBe(null);
  });
  it('makes practice retries idempotent and rejects conflicting event reuse', async () => {
    const body = { eventId: crypto.randomUUID(), algorithmId: 'binary-search' };
    const first = await a.send('post', '/api/practice', body).expect(201);
    const retry = await a.send('post', '/api/practice', body).expect(200);
    expect(retry.body.data.log.id).toBe(first.body.data.log.id);
    await a.send('post', '/api/practice', { ...body, algorithmId: 'bubble-sort' }).expect(409);
    expect((await a.agent.get('/api/practice/summary')).body.data.totalPractices).toBe(1);
    expect((await b.agent.get('/api/practice/summary')).body.data.totalPractices).toBe(0);
  });
  it('uses server-derived dates rather than accepting a forged practice date', async () => {
    await a
      .send('post', '/api/practice', {
        eventId: crypto.randomUUID(),
        algorithmId: 'bfs',
        practiceDate: '2000-01-01',
      })
      .expect(400);
    const result = await a
      .send('post', '/api/practice', { eventId: crypto.randomUUID(), algorithmId: 'bfs' })
      .expect(201);
    expect(result.body.data.log.practiceDate).toBe(localDate(new Date(), 'Asia/Kolkata'));
  });
  it('rejects malformed inputs, unknown fields, oversized notes and invalid algorithms', async () => {
    for (const body of [
      { ...problem, userId: 'other' },
      { ...problem, algorithmId: 'missing' },
      { ...problem, input: { values: [null] } },
      { ...problem, notes: 'x'.repeat(5001) },
      { ...problem, mode: 'custom', language: 'python' },
    ])
      await a.send('post', '/api/problems', body).expect(400);
    await a.agent.get('/api/problems?page=0').expect(400);
    await a.agent.get('/api/problems?limit=1000').expect(400);
    await a.send('post', '/api/practice', { eventId: 'bad', algorithmId: 'bfs' }).expect(400);
  });
  it('requires authentication and CSRF for new routes', async () => {
    await request(app).get('/api/problems').expect(401);
    await request(app).get('/api/practice/summary').expect(401);
    await a.agent
      .post('/api/problems')
      .set('Origin', config.CLIENT_ORIGIN)
      .send(problem)
      .expect(403);
  });
});
describe('calendar-based streaks', () => {
  it('uses local midnight, including India’s UTC offset and daylight saving', () => {
    expect(localDate(new Date('2026-10-28T20:00:00Z'), 'Asia/Kolkata')).toBe('2026-10-29');
    expect(localDate(new Date('2026-03-08T07:30:00Z'), 'America/New_York')).toBe('2026-03-08');
    expect(offsetDay('2024-03-01', -1)).toBe('2024-02-29');
  });
  it('allows yesterday’s streak, zero-fills the week and counts unique days', () => {
    const logs = ['2026-10-24', '2026-10-25', '2026-10-27', '2026-10-28', '2026-10-28'].map(
      (practiceDate) => ({ practiceDate }),
    );
    const summary = summarizePractice(logs, '2026-10-29');
    expect(summary).toMatchObject({ currentStreak: 2, longestStreak: 2, totalPractices: 5 });
    expect(summary.weeklyActivity).toHaveLength(7);
    expect(summary.weeklyActivity.at(-1)).toEqual({ date: '2026-10-29', count: 0 });
    expect(summary.weeklyActivity.at(-2).count).toBe(2);
    expect(summarizePractice(logs, '2026-10-30').currentStreak).toBe(0);
    expect(summarizePractice([], '2026-10-29').longestStreak).toBe(0);
  });
});
