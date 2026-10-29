import { afterEach, describe, expect, it, vi } from 'vitest';

const response = (data, status = 200) =>
  new Response(JSON.stringify(status < 400 ? { data } : { error: data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('API security and session behavior', () => {
  it('includes cookies and a CSRF token on mutations', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ csrfToken: 'signed-token' }))
      .mockResolvedValueOnce(response({ user: { id: 'student' } }));
    vi.stubGlobal('fetch', fetch);
    const { api } = await import('./client');
    await api('/auth/login', {
      method: 'POST',
      body: { email: 'student@example.com', password: 'example' },
    });
    expect(fetch.mock.calls[1][1]).toMatchObject({
      credentials: 'include',
      headers: { 'X-CSRF-Token': 'signed-token', 'Content-Type': 'application/json' },
    });
  });
  it('refreshes a rejected CSRF token once before retrying', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ csrfToken: 'old' }))
      .mockResolvedValueOnce(response({ code: 'CSRF_INVALID', message: 'Refresh' }, 403))
      .mockResolvedValueOnce(response({ csrfToken: 'new' }))
      .mockResolvedValueOnce(response({ loggedOut: true }));
    vi.stubGlobal('fetch', fetch);
    const { api } = await import('./client');
    await expect(api('/auth/logout', { method: 'POST' })).resolves.toEqual({ loggedOut: true });
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(fetch.mock.calls[3][1].headers['X-CSRF-Token']).toBe('new');
  });
  it('does not retry a failed login and preserves field details', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ csrfToken: 'token' }))
      .mockResolvedValueOnce(
        response(
          { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', details: [] },
          401,
        ),
      );
    vi.stubGlobal('fetch', fetch);
    const { api } = await import('./client');
    await expect(api('/auth/login', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('notifies the session owner when an authenticated request expires', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(response({ code: 'UNAUTHENTICATED', message: 'Please log in' }, 401)),
    );
    const { api, onSessionExpired } = await import('./client');
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);
    await expect(api('/auth/me')).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
  it('turns network failures into a readable error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { api } = await import('./client');
    await expect(api('/auth/me')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the server. Check your connection and try again.',
    });
  });
});
