import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../lib/auth.js';
import { ApiError } from '../lib/errors.js';
import { logData, localDate, summarizePractice } from '../services/practice.js';
import { algorithms, generateTrace } from '../../../client/src/algorithms/registry.js';

function validate(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Check your input',
      result.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
    );
  return result.data;
}
const ids = new Set(algorithms.map((item) => item.id));
const algorithmId = z.string().refine((id) => ids.has(id), 'Unknown algorithm');
const json = z.unknown().refine((value) => {
  try {
    return value !== undefined && Buffer.byteLength(JSON.stringify(value)) <= 20000;
  } catch {
    return false;
  }
}, 'Input must be JSON of at most 20 KB');
const fields = {
  title: z.string().trim().min(1).max(120),
  mode: z.enum(['library', 'custom']),
  algorithmId: algorithmId.nullable().optional(),
  sourceCode: z
    .string()
    .refine((s) => Buffer.byteLength(s) <= 20000, 'Source must be at most 20 KB')
    .nullable()
    .optional(),
  language: z.enum(['javascript', 'java', 'c']).nullable().optional(),
  visualVariable: z
    .string()
    .max(80)
    .regex(/^(?:[A-Za-z_$][\w$]*)?$/)
    .default(''),
  input: json,
  tags: z.array(z.string().trim().min(1).max(24)).max(10).default([]),
  notes: z.string().max(5000).default(''),
  status: z.enum(['solved', 'revisit']).default('revisit'),
};
const problemSchema = z
  .object(fields)
  .strict()
  .superRefine((data, ctx) => {
    if (data.mode === 'library' && !data.algorithmId)
      ctx.addIssue({ code: 'custom', path: ['algorithmId'], message: 'Select an algorithm' });
    if (data.mode === 'custom' && (!data.sourceCode?.trim() || !data.language))
      ctx.addIssue({
        code: 'custom',
        path: ['sourceCode'],
        message: 'Provide source and language',
      });
  });
const patchSchema = z
  .object(
    Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        (value instanceof z.ZodDefault ? value.removeDefault() : value).optional(),
      ]),
    ),
  )
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide a field to update');
const dto = (row) => ({
  id: row.id,
  title: row.title,
  mode: row.mode,
  algorithmId: row.algorithmId,
  sourceCode: row.sourceCode,
  language: row.language,
  visualVariable: row.visualVariable,
  input: JSON.parse(row.inputJson),
  tags: JSON.parse(row.tagsJson),
  notes: row.notes,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
function storage(data) {
  if (data.mode === 'library') {
    try {
      generateTrace(data.algorithmId, data.input);
    } catch (error) {
      throw new ApiError(400, 'VALIDATION_ERROR', error.message);
    }
  }
  return {
    title: data.title,
    mode: data.mode,
    algorithmId: data.mode === 'library' ? data.algorithmId : null,
    sourceCode: data.mode === 'custom' ? data.sourceCode : null,
    language: data.mode === 'custom' ? data.language : null,
    visualVariable: data.visualVariable,
    inputJson: JSON.stringify(data.input),
    tagsJson: JSON.stringify([...new Set(data.tags.map((tag) => tag.toLowerCase()))]),
    notes: data.notes,
    status: data.status,
  };
}
const missing = () => new ApiError(404, 'NOT_FOUND', 'Problem not found');
export function problemRouter(db, config) {
  const router = Router();
  router.use(authenticate(db, config));
  router.get('/', async (req, res) => {
    const query = validate(
      z
        .object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
          limit: z.coerce.number().int().min(1).max(50).default(20),
          status: z.enum(['solved', 'revisit']).optional(),
          q: z.string().max(120).optional(),
          tag: z.string().max(24).optional(),
        })
        .strict(),
      req.query,
    );
    const where = {
      userId: req.user.id,
      ...(query.status && { status: query.status }),
      ...(query.tag && { tagsJson: { contains: JSON.stringify(query.tag.trim().toLowerCase()) } }),
      ...(query.q && { OR: [{ title: { contains: query.q } }, { notes: { contains: query.q } }] }),
    };
    const [items, total] = await db.$transaction([
      db.savedProblem.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      db.savedProblem.count({ where }),
    ]);
    res.json({ data: { items: items.map(dto), total, page: query.page, limit: query.limit } });
  });
  router.post('/', async (req, res) => {
    const data = storage(validate(problemSchema, req.body));
    const problem = await db.$transaction(async (tx) => {
      const row = await tx.savedProblem.create({ data: { ...data, userId: req.user.id } });
      if (data.status === 'solved')
        await tx.practiceLog.create({
          data: logData(req.user, {
            savedProblemId: row.id,
            algorithmId: row.algorithmId,
            eventId: crypto.randomUUID(),
          }),
        });
      return row;
    });
    res.status(201).json({ data: { problem: dto(problem) } });
  });
  router.get('/:id', async (req, res) => {
    const row = await db.savedProblem.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!row) throw missing();
    res.json({ data: { problem: dto(row) } });
  });
  router.patch('/:id', async (req, res) => {
    const patch = validate(patchSchema, req.body);
    const problem = await db.$transaction(async (tx) => {
      const current = await tx.savedProblem.findFirst({
        where: { id: req.params.id, userId: req.user.id },
      });
      if (!current) throw missing();
      const previous = dto(current);
      const base = Object.fromEntries(Object.keys(fields).map((key) => [key, previous[key]]));
      const data = storage(validate(problemSchema, { ...base, ...patch }));
      const updated = await tx.savedProblem.update({ where: { id: current.id }, data });
      if (data.status === 'solved' && current.status !== 'solved')
        await tx.practiceLog.create({
          data: logData(req.user, {
            savedProblemId: current.id,
            algorithmId: updated.algorithmId,
            eventId: crypto.randomUUID(),
          }),
        });
      return updated;
    });
    res.json({ data: { problem: dto(problem) } });
  });
  router.delete('/:id', async (req, res) => {
    const result = await db.savedProblem.deleteMany({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!result.count) throw missing();
    res.json({ data: { deleted: true } });
  });
  return router;
}
export function practiceRouter(db, config) {
  const router = Router();
  router.use(authenticate(db, config));
  router.post('/', async (req, res) => {
    const input = validate(
      z
        .object({
          eventId: z.uuid(),
          savedProblemId: z.string().min(1).max(100).optional(),
          algorithmId: algorithmId.optional(),
        })
        .strict()
        .refine((v) => v.savedProblemId || v.algorithmId, 'Supply a saved problem or algorithm'),
      req.body,
    );
    const existing = await db.practiceLog.findUnique({
      where: { userId_eventId: { userId: req.user.id, eventId: input.eventId } },
    });
    if (existing) {
      if (
        existing.savedProblemId !== (input.savedProblemId ?? null) ||
        existing.algorithmId !== (input.algorithmId ?? null)
      )
        throw new ApiError(409, 'EVENT_CONFLICT', 'Event ID belongs to a different practice');
      return res.json({ data: { log: existing } });
    }
    let created = true;
    const log = await db
      .$transaction(async (tx) => {
        if (input.savedProblemId) {
          const target = await tx.savedProblem.findFirst({
            where: { id: input.savedProblemId, userId: req.user.id },
          });
          if (!target) throw missing();
          if (input.algorithmId && input.algorithmId !== target.algorithmId)
            throw new ApiError(
              400,
              'VALIDATION_ERROR',
              'Algorithm does not match the saved problem',
            );
        }
        return tx.practiceLog.create({ data: logData(req.user, input) });
      })
      .catch(async (error) => {
        if (error.code !== 'P2002') throw error;
        const winner = await db.practiceLog.findUnique({
          where: { userId_eventId: { userId: req.user.id, eventId: input.eventId } },
        });
        if (!winner) throw error;
        if (
          winner.savedProblemId !== (input.savedProblemId ?? null) ||
          winner.algorithmId !== (input.algorithmId ?? null)
        )
          throw new ApiError(409, 'EVENT_CONFLICT', 'Event ID belongs to a different practice');
        created = false;
        return winner;
      });
    res.status(created ? 201 : 200).json({ data: { log } });
  });
  router.get('/summary', async (req, res) => {
    const logs = await db.practiceLog.findMany({
      where: { userId: req.user.id },
      select: { practiceDate: true },
    });
    const [totalProblems, solvedProblems] = await db.$transaction([
      db.savedProblem.count({ where: { userId: req.user.id } }),
      db.savedProblem.count({ where: { userId: req.user.id, status: 'solved' } }),
    ]);
    res.json({
      data: {
        ...summarizePractice(logs, localDate(new Date(), req.user.timeZone)),
        totalProblems,
        solvedProblems,
        timeZone: req.user.timeZone,
      },
    });
  });
  return router;
}
