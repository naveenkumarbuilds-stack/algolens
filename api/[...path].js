import { isIP } from 'node:net';
import { randomUUID } from 'node:crypto';

function problem(status, code, message) {
  const error = new Error(message);
  Object.assign(error, { status, code });
  return error;
}
async function requestBody(req) {
  if (['GET', 'HEAD'].includes(req.method)) return undefined;
  if (req.body !== undefined) {
    const text =
      typeof req.body === 'string'
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString('utf8')
          : JSON.stringify(req.body);
    if (Buffer.byteLength(text) > 262144)
      throw problem(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    return text;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 262144) throw problem(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    chunks.push(buffer);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}
export function createProxy(env = process.env, fetchImpl = fetch) {
  return async (req, res) => {
    const id = randomUUID();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Request-Id', id);
    let timer;
    try {
      let origin;
      try {
        origin = new URL(env.BACKEND_ORIGIN);
      } catch {
        throw problem(503, 'PROXY_UNCONFIGURED', 'The backend address is not configured');
      }
      if (
        origin.protocol !== 'https:' ||
        origin.username ||
        origin.password ||
        origin.pathname !== '/' ||
        origin.search ||
        origin.hash ||
        !env.PROXY_SECRET ||
        env.PROXY_SECRET.length < 48
      )
        throw problem(503, 'PROXY_UNCONFIGURED', 'The secure API proxy is not configured');
      if (!['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'].includes(req.method))
        throw problem(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
      const path = new URL(req.url, 'https://algolens.invalid');
      if (!path.pathname.startsWith('/api/'))
        throw problem(404, 'NOT_FOUND', 'API route not found');
      const ip = String(req.headers['x-vercel-forwarded-for'] || '').trim();
      if (!isIP(ip))
        throw problem(
          503,
          'PROXY_UNCONFIGURED',
          'The hosting platform did not provide a valid client address',
        );
      const headers = { 'x-algolens-proxy-token': env.PROXY_SECRET, 'x-algolens-client-ip': ip };
      for (const name of ['content-type', 'cookie', 'origin', 'x-csrf-token', 'accept'])
        if (typeof req.headers[name] === 'string') headers[name] = req.headers[name];
      const body = await requestBody(req),
        controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 12000);
      const upstream = await fetchImpl(new URL(path.pathname + path.search, origin), {
        method: req.method,
        headers,
        body,
        signal: controller.signal,
        redirect: 'error',
      });
      const chunks = [];
      let size = 0;
      if (upstream.body) {
        const reader = upstream.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 4 * 1024 * 1024) {
              await reader.cancel();
              throw problem(
                502,
                'PROXY_RESPONSE_TOO_LARGE',
                'Backend response exceeded its size limit',
              );
            }
            chunks.push(Buffer.from(value));
          }
        } finally {
          reader.releaseLock();
        }
      }
      const cookies = upstream.headers.getSetCookie();
      if (cookies.length) res.setHeader('Set-Cookie', cookies);
      for (const name of [
        'content-type',
        'x-request-id',
        'retry-after',
        'ratelimit',
        'ratelimit-policy',
      ]) {
        const value = upstream.headers.get(name);
        if (value) res.setHeader(name, value);
      }
      res.statusCode = upstream.status;
      res.end(req.method === 'HEAD' ? undefined : Buffer.concat(chunks));
    } catch (error) {
      res.statusCode = error.status || (error.name === 'AbortError' ? 504 : 502);
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: {
            code:
              error.code || (res.statusCode === 504 ? 'BACKEND_TIMEOUT' : 'BACKEND_UNAVAILABLE'),
            message: error.status
              ? error.message
              : 'The backend is unavailable or waking up. Try again shortly.',
            requestId: id,
          },
        }),
      );
    } finally {
      clearTimeout(timer);
    }
  };
}
export default createProxy();
