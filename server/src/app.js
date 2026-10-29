import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { trustedProxy } from './middleware/proxy.js';
import { csrfProtection } from './lib/auth.js';
import { ApiError, errorHandler } from './lib/errors.js';
import { authRouter } from './routes/auth.js';
import { problemRouter, practiceRouter } from './routes/problems.js';
import { explainRouter } from './routes/explain.js';

export async function createApp({ db, config, generalLimit = 300, authLimit = 20, aiOptions }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);
  app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.set('X-Request-Id', req.id);
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(helmet());
  app.use(trustedProxy(config));
  app.use(
    cors({
      origin: config.CLIENT_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    }),
  );
  const limiter = (limit) =>
    rateLimit({
      windowMs: 15 * 60000,
      limit,
      keyGenerator: (req) => ipKeyGenerator(req.proxyClientIp || req.ip),
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (req) => req.originalUrl.split('?')[0] === '/api/health',
      handler: (_req, _res, next) =>
        next(new ApiError(429, 'RATE_LIMITED', 'Too many requests; try again later')),
    });
  app.use('/api', limiter(generalLimit));
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use('/api', csrfProtection(config));
  app.get('/api/health', async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      throw new ApiError(503, 'UNAVAILABLE', 'Database unavailable');
    }
    res.json({ data: { status: 'ok' } });
  });
  app.use('/api/auth', await authRouter(db, config, limiter(authLimit)));
  app.use('/api/problems', problemRouter(db, config));
  app.use('/api/practice', practiceRouter(db, config));
  app.use('/api/explain', explainRouter(db, config, aiOptions));
  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found')));
  app.use(errorHandler);
  return app;
}
