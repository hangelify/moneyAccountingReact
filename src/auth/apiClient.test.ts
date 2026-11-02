import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import type { AxiosRequestConfig } from 'axios';
import type { AuthMessage } from './authChannel';

const channel = vi.hoisted(() => {
  const state: {
    handler: ((msg: AuthMessage) => void) | null;
  } = { handler: null };
  return {
    state,
    post: vi.fn(),
    subscribe: vi.fn((h: (msg: AuthMessage) => void) => {
      state.handler = h;
      return (): void => undefined;
    }),
  };
});

vi.mock('./authChannel', () => ({
  authChannel: { post: channel.post, subscribe: channel.subscribe },
}));

import {
  apiClient,
  AUTH_LOGOUT_EVENT,
  AUTH_TOKEN_EVENT,
  refreshAccessToken,
} from './apiClient';
import { tokenStorage } from './tokenStorage';
import { ApiError } from './apiError';

const tokenRes = (
  access_token: string,
  expires_in = 900
): { access_token: string; expires_in: number; token_type: 'Bearer' } => ({
  access_token,
  expires_in,
  token_type: 'Bearer',
});

let mock: MockAdapter;
let refreshCalls: number;
let logoutEvents: CustomEvent<{ reason: string }>[];
let tokenEvents: Event[];

const onLogout = (e: Event): void => {
  logoutEvents.push(e as CustomEvent<{ reason: string }>);
};
const onToken = (e: Event): void => {
  tokenEvents.push(e);
};

/** Registers a /auth/refresh handler that counts calls. */
function replyRefresh(
  reply: (
    config: AxiosRequestConfig
  ) => [number, unknown?] | Promise<[number, unknown?]>
): void {
  mock.onPost('/auth/refresh').reply((config) => {
    refreshCalls += 1;
    return reply(config);
  });
}

function removeLocks(): void {
  Reflect.deleteProperty(navigator, 'locks');
}

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  refreshCalls = 0;
  logoutEvents = [];
  tokenEvents = [];
  tokenStorage.clear({ broadcast: false });
  channel.post.mockClear();
  window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
  window.addEventListener(AUTH_TOKEN_EVENT, onToken);
});

afterEach(() => {
  window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
  window.removeEventListener(AUTH_TOKEN_EVENT, onToken);
  tokenStorage.clear({ broadcast: false });
  removeLocks();
  mock.restore();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('apiClient request interceptor', () => {
  it('attaches Authorization header when access token present', async () => {
    tokenStorage.set(tokenRes('tok-1'), { broadcast: false });
    mock.onGet('/budgets').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer tok-1');
      return [200, []];
    });
    await apiClient.get('/budgets');
  });

  it('omits Authorization header when access token absent', async () => {
    mock.onGet('/budgets').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, []];
    });
    await apiClient.get('/budgets');
  });

  it('instance sends credentials', () => {
    expect(apiClient.defaults.withCredentials).toBe(true);
  });
});

describe('apiClient response interceptor — error mapping', () => {
  it('maps a 400 to ApiError with status, message, body', async () => {
    mock.onPost('/budgets').reply(400, {
      message: 'Validation failed',
      code: 'VALIDATION',
      errors: { name: ['required'] },
    });
    await expect(apiClient.post('/budgets', {})).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Validation failed',
    });
  });

  it('attaches request url and axios code to ApiError', async () => {
    mock.onGet('/households/h1/markets').reply(403, { message: 'Forbidden' });
    await expect(apiClient.get('/households/h1/markets')).rejects.toMatchObject(
      { status: 403, url: '/households/h1/markets' }
    );

    mock.onGet('/households/h1/slow').timeout();
    await expect(apiClient.get('/households/h1/slow')).rejects.toMatchObject({
      code: 'ECONNABORTED',
    });
  });

  it('maps a 500 with no body to ApiError with axios message', async () => {
    mock.onGet('/anything').reply(500);
    await expect(apiClient.get('/anything')).rejects.toBeInstanceOf(ApiError);
  });

  it('exposes Retry-After from real axios response headers', async () => {
    mock
      .onPost('/auth/login')
      .reply(429, { message: 'Too many attempts' }, { 'Retry-After': '120' });
    const err = await apiClient
      .post('/auth/login', {})
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).retryAfterSeconds()).toBe(120);
  });
});

describe('apiClient — refresh flow', () => {
  it('refresh posts with no body', async () => {
    replyRefresh((config) => {
      expect(config.data === undefined || config.data === '{}').toBe(true);
      expect(String(config.data ?? '')).not.toContain('refresh_token');
      expect(config).not.toHaveProperty('refresh_token');
      return [200, tokenRes('new')];
    });
    await refreshAccessToken();
    expect(refreshCalls).toBe(1);
    expect(tokenStorage.getAccessToken()).toBe('new');
  });

  it('on 401, refreshes and replays once', async () => {
    tokenStorage.set(tokenRes('old'), { broadcast: false });
    replyRefresh(() => [200, tokenRes('new')]);

    let call = 0;
    mock.onGet('/budgets').reply((config) => {
      call += 1;
      if (call === 1) return [401, { message: 'Unauthorized' }];
      expect(config.headers?.Authorization).toBe('Bearer new');
      return [200, [{ id: 1 }]];
    });

    const res = await apiClient.get('/budgets');
    expect(res.data).toEqual([{ id: 1 }]);
    expect(call).toBe(2);
    expect(refreshCalls).toBe(1);
    expect(tokenStorage.getAccessToken()).toBe('new');
  });

  it('5 parallel 401s → one /auth/refresh', async () => {
    tokenStorage.set(tokenRes('old'), { broadcast: false });
    replyRefresh(() => [200, tokenRes('new')]);
    mock
      .onGet('/budgets')
      .reply((config) =>
        config.headers?.Authorization === 'Bearer old'
          ? [401, { message: 'Unauthorized' }]
          : [200, [{ id: 1 }]]
      );

    const results = await Promise.all(
      Array.from({ length: 5 }, () => apiClient.get('/budgets'))
    );
    for (const r of results) expect(r.status).toBe(200);
    expect(refreshCalls).toBe(1);
  });

  it('timer refresh and a 401 at the same moment → one /auth/refresh', async () => {
    vi.useFakeTimers();
    tokenStorage.set(tokenRes('old', 61), { broadcast: false });

    let releaseRefresh: () => void = () => undefined;
    replyRefresh(
      () =>
        new Promise((resolve) => {
          releaseRefresh = (): void => resolve([200, tokenRes('new')]);
        })
    );
    mock
      .onGet('/budgets')
      .reply((config) =>
        config.headers?.Authorization === 'Bearer old'
          ? [401, { message: 'Unauthorized' }]
          : [200, [{ id: 1 }]]
      );

    const pending = apiClient.get('/budgets');
    await vi.advanceTimersByTimeAsync(5000);
    releaseRefresh();
    const res = await pending;

    expect(res.status).toBe(200);
    expect(refreshCalls).toBe(1);
    expect(logoutEvents).toHaveLength(0);
  });

  it('timer refresh failure signs out', async () => {
    vi.useFakeTimers();
    tokenStorage.set(tokenRes('old', 61), { broadcast: false });
    replyRefresh(() => [401, { message: 'Session not found or revoked' }]);

    await vi.advanceTimersByTimeAsync(5000);

    expect(refreshCalls).toBe(1);
    expect(logoutEvents).toHaveLength(1);
    expect(logoutEvents[0]?.detail.reason).toBe('revoked');
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it('uses navigator.locks when present', async () => {
    const request = vi.fn((_name: string, cb: () => Promise<void>) => cb());
    Object.defineProperty(navigator, 'locks', {
      value: { request },
      configurable: true,
    });
    replyRefresh(() => [200, tokenRes('new')]);

    await refreshAccessToken();

    expect(request).toHaveBeenCalledWith('auth-refresh', expect.any(Function));
    expect(refreshCalls).toBe(1);
  });

  it('skips the network when another tab refreshed while waiting for the lock', async () => {
    tokenStorage.set(tokenRes('old'), { broadcast: false });
    const request = vi.fn((_name: string, cb: () => Promise<void>) => {
      // Another tab finished its refresh and broadcast the new token.
      tokenStorage.set(tokenRes('from-other-tab'), { broadcast: false });
      return cb();
    });
    Object.defineProperty(navigator, 'locks', {
      value: { request },
      configurable: true,
    });
    replyRefresh(() => [200, tokenRes('new')]);
    mock
      .onGet('/budgets')
      .reply((config) =>
        config.headers?.Authorization === 'Bearer old'
          ? [401, { message: 'Unauthorized' }]
          : [200, [{ id: 1 }]]
      );

    const res = await apiClient.get('/budgets');

    expect(res.status).toBe(200);
    expect(refreshCalls).toBe(0);
    expect(tokenStorage.getAccessToken()).toBe('from-other-tab');
  });

  it("refresh 401 → signOut('expired')", async () => {
    tokenStorage.set(tokenRes('old'), { broadcast: false });
    replyRefresh(() => [401, { message: 'Invalid refresh token' }]);
    mock.onGet('/budgets').reply(401, { message: 'Token expired' });

    const err = await apiClient.get('/budgets').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, message: 'Token expired' });
    expect(logoutEvents).toHaveLength(1);
    expect(logoutEvents[0]?.detail.reason).toBe('expired');
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(channel.post).toHaveBeenCalledWith({
      type: 'logout',
      reason: 'expired',
    });
  });

  it("401 'Session not found or revoked' → reason 'revoked'", async () => {
    tokenStorage.set(tokenRes('old'), { broadcast: false });
    replyRefresh(() => [401, { message: 'Session not found or revoked' }]);
    mock.onGet('/budgets').reply(401, { message: 'Token expired' });

    await expect(apiClient.get('/budgets')).rejects.toMatchObject({
      status: 401,
      message: 'Token expired',
    });
    expect(logoutEvents).toHaveLength(1);
    expect(logoutEvents[0]?.detail.reason).toBe('revoked');
  });

  it("401 'Session is no longer active' → reason 'revoked'", async () => {
    tokenStorage.set(tokenRes('old'), { broadcast: false });
    replyRefresh(() => [401, { message: ['Session is no longer active'] }]);
    mock.onGet('/budgets').reply(401, { message: 'Token expired' });

    await expect(apiClient.get('/budgets')).rejects.toBeInstanceOf(ApiError);
    expect(logoutEvents[0]?.detail.reason).toBe('revoked');
  });

  it('replay returning 401 → signOut', async () => {
    tokenStorage.set(tokenRes('old'), { broadcast: false });
    replyRefresh(() => [200, tokenRes('new')]);
    let call = 0;
    mock.onGet('/budgets').reply(() => {
      call += 1;
      return [401, { message: call === 1 ? 'first' : 'second' }];
    });

    await expect(apiClient.get('/budgets')).rejects.toMatchObject({
      status: 401,
      message: 'first',
    });
    expect(call).toBe(2);
    expect(refreshCalls).toBe(1);
    expect(logoutEvents).toHaveLength(1);
    expect(logoutEvents[0]?.detail.reason).toBe('expired');
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it('does not refresh on 401 from /auth/logout or /auth/revoke', async () => {
    tokenStorage.set(tokenRes('old'), { broadcast: false });
    replyRefresh(() => [200, tokenRes('new')]);
    mock.onPost('/auth/logout').reply(401, { message: 'nope' });
    mock.onPost('/auth/revoke').reply(401, { message: 'nope' });

    await expect(apiClient.post('/auth/logout')).rejects.toMatchObject({
      status: 401,
    });
    await expect(apiClient.post('/auth/revoke')).rejects.toMatchObject({
      status: 401,
    });
    expect(refreshCalls).toBe(0);
    expect(logoutEvents).toHaveLength(0);
  });

  it('does not refresh on 401 from /auth/login', async () => {
    replyRefresh(() => [200, tokenRes('new')]);
    mock.onPost('/auth/login').reply(401, { message: 'bad creds' });
    await expect(apiClient.post('/auth/login', {})).rejects.toMatchObject({
      status: 401,
      message: 'bad creds',
    });
    expect(refreshCalls).toBe(0);
  });
});

describe('apiClient — cross-tab messages', () => {
  it('incoming token broadcast sets token and dispatches auth:token', () => {
    expect(channel.state.handler).not.toBeNull();
    channel.state.handler?.({ type: 'token', res: tokenRes('shared') });

    expect(tokenStorage.getAccessToken()).toBe('shared');
    expect(tokenEvents).toHaveLength(1);
    expect(channel.post).not.toHaveBeenCalled();
  });

  it('incoming logout broadcast clears without re-broadcasting', () => {
    tokenStorage.set(tokenRes('old'), { broadcast: false });
    channel.state.handler?.({ type: 'logout', reason: 'revoked' });

    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(logoutEvents).toHaveLength(1);
    expect(logoutEvents[0]?.detail.reason).toBe('revoked');
    expect(channel.post).not.toHaveBeenCalled();
  });
});

describe('apiClient — refresh failure handling', () => {
  it('5 parallel 401s + refresh 401 → exactly 1 auth:logout event and 1 authChannel.post', async () => {
    tokenStorage.set(tokenRes('old'), { broadcast: false });
    replyRefresh(() => [401, { message: 'Invalid refresh token' }]);
    mock.onGet('/budgets').reply(401, { message: 'Token expired' });

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => apiClient.get('/budgets'))
    );

    for (const r of results) expect(r.status).toBe('rejected');
    expect(refreshCalls).toBe(1);
    expect(logoutEvents).toHaveLength(1);
    expect(channel.post).toHaveBeenCalledTimes(1);
    expect(channel.post).toHaveBeenCalledWith({
      type: 'logout',
      reason: 'expired',
    });
  });

  it('refresh 503 → original request rejects, no auth:logout, token kept', async () => {
    tokenStorage.set(tokenRes('old'), { broadcast: false });
    replyRefresh(() => [503, { message: 'Service Unavailable' }]);
    mock.onGet('/budgets').reply(401, { message: 'Token expired' });

    await expect(apiClient.get('/budgets')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      message: 'Token expired',
    });
    expect(refreshCalls).toBe(1);
    expect(logoutEvents).toHaveLength(0);
    expect(channel.post).not.toHaveBeenCalled();
    expect(tokenStorage.getAccessToken()).toBe('old');
  });

  it('refresh 403 → no auth:logout, token kept', async () => {
    tokenStorage.set(tokenRes('old'), { broadcast: false });
    replyRefresh(() => [403, { message: 'Forbidden' }]);
    mock.onGet('/budgets').reply(401, { message: 'Token expired' });

    await expect(apiClient.get('/budgets')).rejects.toMatchObject({
      status: 401,
    });
    expect(logoutEvents).toHaveLength(0);
    expect(tokenStorage.getAccessToken()).toBe('old');
  });

  it('timer refresh network error → no auth:logout', async () => {
    vi.useFakeTimers();
    tokenStorage.set(tokenRes('old', 61), { broadcast: false });
    mock.onPost('/auth/refresh').networkErrorOnce();

    await vi.advanceTimersByTimeAsync(5000);

    expect(mock.history.post).toHaveLength(1);
    expect(logoutEvents).toHaveLength(0);
    expect(channel.post).not.toHaveBeenCalled();
    expect(tokenStorage.getAccessToken()).toBe('old');
  });

  it('another tab signs out while waiting for the lock → no network, no second auth:logout', async () => {
    tokenStorage.set(tokenRes('old'), { broadcast: false });
    const request = vi.fn((_name: string, cb: () => Promise<void>) => {
      // Another tab logged out; its broadcast reaches this tab first.
      channel.state.handler?.({ type: 'logout', reason: 'user' });
      return cb();
    });
    Object.defineProperty(navigator, 'locks', {
      value: { request },
      configurable: true,
    });
    replyRefresh(() => [200, tokenRes('new')]);
    mock.onGet('/budgets').reply(401, { message: 'Token expired' });

    await expect(apiClient.get('/budgets')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      message: 'Token expired',
    });
    expect(refreshCalls).toBe(0);
    expect(logoutEvents).toHaveLength(1);
    expect(logoutEvents[0]?.detail.reason).toBe('user');
    expect(channel.post).not.toHaveBeenCalled();
    expect(tokenStorage.getAccessToken()).toBeNull();
  });
});
