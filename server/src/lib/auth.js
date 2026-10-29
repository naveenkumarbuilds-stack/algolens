import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ApiError } from './errors.js';

export const publicUser = ({ id, email, name, timeZone, createdAt, updatedAt }) => ({
  id,
  email,
  name,
  timeZone,
  createdAt,
  updatedAt,
});
export const cookieOptions = (config) => ({
  httpOnly: true,
  secure: config.secureCookie,
  sameSite: 'lax',
  path: '/',
});
export const sessionCookie = (config) =>
  config.secureCookie ? '__Host-algolens_session' : 'algolens_session';
export const csrfCookie = (config) =>
  config.secureCookie ? '__Host-algolens_csrf' : 'algolens_csrf';

export function issueSession(res, userId, config) {
  const token = jwt.sign({}, config.JWT_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    issuer: 'algolens-api',
    audience: 'algolens-client',
    expiresIn: '7d',
  });
  res.cookie(sessionCookie(config), token, { ...cookieOptions(config), maxAge: 7 * 86400000 });
}

export function authenticate(db, config) {
  return async (req, _res, next) => {
    let claims;
    try {
      claims = jwt.verify(req.cookies[sessionCookie(config)] || '', config.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'algolens-api',
        audience: 'algolens-client',
      });
      if (typeof claims.sub !== 'string') throw new Error('Missing subject');
    } catch {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Please log in');
    }
    const user = await db.user.findUnique({ where: { id: claims.sub } });
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Please log in');
    req.user = user;
    next();
  };
}

// HMAC prevents a forged cookie/header pair from satisfying double-submit validation.
function signature(value, config) {
  return crypto.createHmac('sha256', config.JWT_SECRET).update(`csrf:${value}`).digest('hex');
}
export function issueCsrf(res, config) {
  const nonce = crypto.randomBytes(32).toString('hex');
  const token = `${nonce}.${signature(nonce, config)}`;
  res.cookie(csrfCookie(config), token, { ...cookieOptions(config), maxAge: 7 * 86400000 });
  return token;
}
export function csrfProtection(config) {
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const token = req.get('x-csrf-token');
    const cookie = req.cookies[csrfCookie(config)];
    const validShape = typeof token === 'string' && /^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token);
    if (
      req.get('origin') !== config.CLIENT_ORIGIN ||
      !validShape ||
      token !== cookie ||
      !crypto.timingSafeEqual(
        Buffer.from(token.split('.')[1]),
        Buffer.from(signature(token.split('.')[0], config)),
      )
    ) {
      throw new ApiError(403, 'CSRF_INVALID', 'Refresh the page and try again');
    }
    next();
  };
}
