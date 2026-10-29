import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { authenticate } from '../lib/auth.js';
import { ApiError } from '../lib/errors.js';
import { explainStep } from '../services/explain.js';
import { algorithms } from '../../../client/src/algorithms/registry.js';

const schema = z
  .object({
    consent: z.literal(true),
    algorithmId: z
      .string()
      .refine((id) => algorithms.some((a) => a.id === id), 'Unknown algorithm')
      .optional(),
    language: z.enum(['javascript', 'java', 'c', 'pseudocode']).default('javascript'),
    sourceCode: z
      .string()
      .refine((text) => Buffer.byteLength(text) <= 20000, 'Source must be at most 20 KB')
      .optional(),
    step: z
      .object({
        type: z.enum([
          'initial',
          'compare',
          'swap',
          'write',
          'visit',
          'enqueue',
          'dequeue',
          'push',
          'pop',
          'relax',
          'return',
          'complete',
          'snapshot',
        ]),
        line: z.number().int().min(1).max(20000).nullable(),
        variables: z.record(z.string(), z.unknown()),
        explanation: z.string().min(1).max(3000),
      })
      .strict()
      .refine((value) => {
        try {
          return Buffer.byteLength(JSON.stringify(value)) <= 12000;
        } catch {
          return false;
        }
      }, 'Selected step must be at most 12 KB'),
  })
  .strict();
export function explainRouter(db, config, { fetchImpl = fetch, limit = 6 } = {}) {
  const router = Router();
  router.get('/status', (_req, res) =>
    res.json({ data: { enabled: Boolean(config.AI_API_KEY), provider: 'OpenAI' } }),
  );
  router.post(
    '/',
    authenticate(db, config),
    rateLimit({
      windowMs: 15 * 60000,
      limit,
      keyGenerator: (req) => req.user.id,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, _res, next) =>
        next(
          new ApiError(
            429,
            'AI_RATE_LIMITED',
            'AI explanations are limited to six requests per 15 minutes.',
          ),
        ),
    }),
    async (req, res) => {
      const result = schema.safeParse(req.body);
      if (!result.success)
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'Check your AI explanation request',
          result.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
        );
      res.json({ data: await explainStep(config, result.data, fetchImpl) });
    },
  );
  return router;
}
