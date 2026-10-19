import { describe, it, expect, beforeEach, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from './apiClient';
import { tokenStorage } from './tokenStorage';
import { ApiError } from './apiError';

let mock: MockAdapter;

beforeEach(() => {
  vi.restoreAllMocks();
  mock = new MockAdapter(apiClient);
  localStorage.clear();
  tokenStorage.clear();
});

describe('apiClient request interceptor', () => {
  it('attaches Authorization header when access token present', async () => {
    tokenStorage.setAccessToken('tok-1', 60);
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

  it('maps a 500 with no body to ApiError with axios message', async () => {
    mock.onGet('/anything').reply(500);
    await expect(apiClient.get('/anything')).rejects.toBeInstanceOf(ApiError);
  });
});

import { AUTH_LOGOUT_EVENT } from './apiClient';
import axios from 'axios';

describe('apiClient response interceptor — refresh flow', () => {
  it('on 401, refreshes and retries the original request once', async () => {
    tokenStorage.setAccessToken('old', 60);
    tokenStorage.setRefreshToken('rt-1');

    // /auth/refresh hits the BASE axios (not apiClient), so we mock global axios.post.
    const refreshSpy = vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        access_token: 'new',
        refresh_token: 'rt-2',
        expires_in: 60,
        token_type: 'Bearer',
      },
    });

    let call = 0;
    mock.onGet('/budgets').reply((config) => {
      call += 1;
      if (call === 1) return [401, { message: 'expired' }];
      expect(config.headers?.Authorization).toBe('Bearer new');
      return [200, [{ id: 1 }]];
    });

    const res = await apiClient.get('/budgets');
    expect(res.data).toEqual([{ id: 1 }]);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(tokenStorage.getAccessToken()).toBe('new');
    expect(tokenStorage.getRefreshToken()).toBe('rt-2');

    refreshSpy.mockRestore();
  });

  it('coalesces 5 parallel 401s onto a single /auth/refresh call', async () => {
    tokenStorage.setAccessToken('old', 60);
    tokenStorage.setRefreshToken('rt-1');

    const refreshSpy = vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        access_token: 'new',
        refresh_token: 'rt-2',
        expires_in: 60,
        token_type: 'Bearer',
      },
    });

    const seen = new Set<string>();
    mock.onGet('/budgets').reply((config) => {
      const auth = String(config.headers?.Authorization);
      if (!seen.has(auth)) {
        seen.add(auth);
      }
      if (auth === 'Bearer old') return [401, { message: 'expired' }];
      return [200, [{ id: 1 }]];
    });

    const results = await Promise.all([
      apiClient.get('/budgets'),
      apiClient.get('/budgets'),
      apiClient.get('/budgets'),
      apiClient.get('/budgets'),
      apiClient.get('/budgets'),
    ]);
    for (const r of results) expect(r.status).toBe(200);
    expect(refreshSpy).toHaveBeenCalledTimes(1);

    refreshSpy.mockRestore();
  });

  it('does NOT refresh on 401 from auth endpoints (login/register/refresh)', async () => {
    const refreshSpy = vi.spyOn(axios, 'post').mockResolvedValue({
      data: {
        access_token: 'new',
        refresh_token: 'rt',
        expires_in: 60,
        token_type: 'Bearer',
      },
    });
    mock.onPost('/auth/login').reply(401, { message: 'bad creds' });
    await expect(apiClient.post('/auth/login', {})).rejects.toMatchObject({
      status: 401,
      message: 'bad creds',
    });
    expect(refreshSpy).not.toHaveBeenCalled();
    refreshSpy.mockRestore();
  });

  it('on /auth/refresh failure: clears tokens and emits auth:logout', async () => {
    tokenStorage.setAccessToken('old', 60);
    tokenStorage.setRefreshToken('rt-1');

    vi.spyOn(axios, 'post').mockRejectedValueOnce(
      Object.assign(new Error('refresh failed'), { response: { status: 401 } })
    );
    mock.onGet('/budgets').reply(401, { message: 'expired' });

    const events: Event[] = [];
    const listener = (e: Event): void => {
      events.push(e);
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, listener);

    await expect(apiClient.get('/budgets')).rejects.toMatchObject({
      status: 401,
    });
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
    expect(events).toHaveLength(1);

    window.removeEventListener(AUTH_LOGOUT_EVENT, listener);
  });

  it('does not retry an already-retried request', async () => {
    tokenStorage.setAccessToken('tok', 60);
    tokenStorage.setRefreshToken('rt-1');

    const refreshSpy = vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        access_token: 'new',
        refresh_token: 'rt-2',
        expires_in: 60,
        token_type: 'Bearer',
      },
    });

    // Both attempts return 401 — interceptor should only retry once.
    mock.onGet('/budgets').reply(401, { message: 'expired' });

    await expect(apiClient.get('/budgets')).rejects.toMatchObject({
      status: 401,
    });
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    refreshSpy.mockRestore();
  });

  it('with no refresh token in storage, a 401 emits auth:logout and rejects', async () => {
    const events: Event[] = [];
    const listener = (e: Event): void => {
      events.push(e);
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, listener);

    mock.onGet('/budgets').reply(401, { message: 'expired' });
    await expect(apiClient.get('/budgets')).rejects.toMatchObject({
      status: 401,
    });
    expect(events).toHaveLength(1);

    window.removeEventListener(AUTH_LOGOUT_EVENT, listener);
  });
});
