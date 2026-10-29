import crypto from 'node:crypto';
import { isIP } from 'node:net';
import { ApiError } from '../lib/errors.js';

export function trustedProxy(config) {
  return (req, _res, next) => {
    if (!config.PROXY_SECRET || req.path === '/api/health') return next();
    const supplied = req.get('x-algolens-proxy-token') || '';
    const expected = Buffer.from(config.PROXY_SECRET),
      actual = Buffer.from(supplied);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected))
      throw new ApiError(403, 'PROXY_REQUIRED', 'Use the application website to access this API');
    const client = req.get('x-algolens-client-ip');
    if (!client || !isIP(client))
      throw new ApiError(400, 'INVALID_PROXY_IP', 'A valid client address is required');
    req.proxyClientIp = client;
    next();
  };
}
