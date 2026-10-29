import { z } from 'zod';

export function loadConfig(env = process.env) {
  const parsed = z
    .object({
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      PORT: z.coerce.number().int().min(1).max(65535).default(4000),
      CLIENT_ORIGIN: z.url().default('http://localhost:5173'),
      DATABASE_URL: z.string().min(1),
      JWT_SECRET: z.string().min(48),
      JWT_EXPIRES_IN: z.literal('7d').default('7d'),
      COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
      COOKIE_SAME_SITE: z.literal('lax').default('lax'),
      TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
      PROXY_SECRET: z.union([z.literal(''), z.string().min(48).max(256)]).default(''),
      AI_API_KEY: z.string().trim().max(512).default(''),
      AI_API_BASE_URL: z.literal('https://api.openai.com/v1').default('https://api.openai.com/v1'),
      AI_MODEL: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .regex(/^[a-zA-Z0-9._-]+$/)
        .default('gpt-4.1-mini'),
    })
    .parse(env);
  if (new URL(parsed.CLIENT_ORIGIN).origin !== parsed.CLIENT_ORIGIN) {
    throw new Error('CLIENT_ORIGIN must be an origin without a path or trailing slash');
  }
  if (
    parsed.NODE_ENV === 'production' &&
    (parsed.COOKIE_SECURE !== 'true' || !parsed.CLIENT_ORIGIN.startsWith('https://'))
  ) {
    throw new Error('Production requires secure cookies and an HTTPS client origin');
  }
  if (parsed.NODE_ENV === 'production') {
    if (!parsed.PROXY_SECRET)
      throw new Error('Production requires PROXY_SECRET for the Vercel API proxy');
    if (!/^postgres(?:ql)?:\/\//.test(parsed.DATABASE_URL))
      throw new Error('Production requires PostgreSQL; SQLite is local development only');
  }
  return { ...parsed, secureCookie: parsed.COOKIE_SECURE === 'true' };
}
