import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import {
  authenticate,
  publicUser,
  issueSession,
  issueCsrf,
  cookieOptions,
  sessionCookie,
} from '../lib/auth.js';

const name = z.string().trim().min(1).max(80);
const email = z.string().trim().toLowerCase().email().max(254);
const password = z
  .string()
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') >= 12 && Buffer.byteLength(value, 'utf8') <= 72,
    'Password must contain 12–72 UTF-8 bytes',
  );
const timeZone = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Invalid IANA timezone');
const registerSchema = z
  .object({ name, email, password, timeZone: timeZone.default('Asia/Kolkata') })
  .strict();
const loginSchema = z
  .object({
    email,
    password: z
      .string()
      .min(1)
      .max(200)
      .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password exceeds 72 bytes'),
  })
  .strict();
const profileSchema = z
  .object({ name: name.optional(), timeZone: timeZone.optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide a profile field');

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

export async function authRouter(db, config, authLimiter) {
  const router = Router();
  const requireAuth = authenticate(db, config);
  // Unknown users still perform bcrypt work to reduce account timing differences.
  const dummyHash = await bcrypt.hash('unused-account-password', 12);
  router.get('/csrf', (_req, res) => res.json({ data: { csrfToken: issueCsrf(res, config) } }));
  router.post('/register', authLimiter, async (req, res) => {
    const input = validate(registerSchema, req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await db.user.create({
      data: { name: input.name, email: input.email, timeZone: input.timeZone, passwordHash },
    });
    issueSession(res, user.id, config);
    res.status(201).json({ data: { user: publicUser(user) } });
  });
  router.post('/login', authLimiter, async (req, res) => {
    const input = validate(loginSchema, req.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    const matches = await bcrypt.compare(input.password, user?.passwordHash || dummyHash);
    if (!user || !matches)
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    issueSession(res, user.id, config);
    res.json({ data: { user: publicUser(user) } });
  });
  router.post('/logout', (_req, res) => {
    res.clearCookie(sessionCookie(config), cookieOptions(config));
    res.json({ data: { loggedOut: true } });
  });
  router.get('/me', requireAuth, (req, res) => res.json({ data: { user: publicUser(req.user) } }));
  router.patch('/me', requireAuth, async (req, res) => {
    const input = validate(profileSchema, req.body);
    const user = await db.user.update({ where: { id: req.user.id }, data: input });
    res.json({ data: { user: publicUser(user) } });
  });
  return router;
}
