const baseUrl = (
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api')
).replace(/\/$/, '');
let csrfToken;
let csrfRequest;
const sessionListeners = new Set();

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', details = [], requestId } = {}) {
    super(message);
    Object.assign(this, { status, code, details, requestId });
  }
}

export function onSessionExpired(listener) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

async function send(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ApiError('The server returned an unreadable response. Please try again.', {
        status: response.status,
        code: 'INVALID_RESPONSE',
      });
    }
    if (!response.ok) {
      if (response.status === 401 && payload.error?.code === 'UNAUTHENTICATED')
        sessionListeners.forEach((listener) => listener());
      throw new ApiError(payload.error?.message || 'Your request could not be completed.', {
        status: response.status,
        ...payload.error,
      });
    }
    return payload.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error.name === 'AbortError'
        ? 'The server took too long to respond. Please try again.'
        : 'Cannot reach the server. Check your connection and try again.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function getCsrf() {
  if (csrfToken) return csrfToken;
  // Share bootstrap requests so concurrent mutations do not race cookie rotation.
  if (!csrfRequest)
    csrfRequest = send('/auth/csrf')
      .then((data) => {
        csrfToken = data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfRequest = undefined;
      });
  return csrfRequest;
}

export async function api(path, { method = 'GET', body } = {}) {
  if (method === 'GET') return send(path);
  const mutate = async () =>
    send(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrf() },
      body: JSON.stringify(body ?? {}),
    });
  try {
    return await mutate();
  } catch (error) {
    // CSRF rejection occurs before the route runs, so this single retry is safe.
    if (error.code !== 'CSRF_INVALID') throw error;
    csrfToken = undefined;
    return mutate();
  }
}
