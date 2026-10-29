import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());

vi.mock('./authChannel', () => ({
  authChannel: { post, subscribe: vi.fn() },
}));

import { tokenStorage } from './tokenStorage';

const res = {
  access_token: 'a',
  expires_in: 900,
  token_type: 'Bearer' as const,
};

describe('tokenStorage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T00:00:00Z'));
    post.mockClear();
    tokenStorage.clear({ broadcast: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('never touches localStorage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    tokenStorage.set(res);
    tokenStorage.clear();
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('set stores token and expiresAt', () => {
    tokenStorage.set(res);
    expect(tokenStorage.getAccessToken()).toBe('a');
    expect(tokenStorage.getExpiresAt()).toBe(
      new Date('2026-05-08T00:15:00Z').getTime()
    );
  });

  it('schedules refresh at expires_in - 60s', () => {
    const fn = vi.fn();
    tokenStorage.onRefreshDue(fn);
    tokenStorage.set(res);
    vi.advanceTimersByTime(839_999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('never schedules sooner than 5s', () => {
    const fn = vi.fn();
    tokenStorage.onRefreshDue(fn);
    tokenStorage.set({ ...res, expires_in: 30 });
    vi.advanceTimersByTime(4_999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('clear cancels the timer and bumps version', () => {
    const fn = vi.fn();
    tokenStorage.onRefreshDue(fn);
    tokenStorage.set(res);
    const v = tokenStorage.getVersion();
    tokenStorage.clear({ broadcast: false });
    expect(tokenStorage.getVersion()).toBe(v + 1);
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getExpiresAt()).toBeNull();
    vi.advanceTimersByTime(900_000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('set bumps version and replaces the pending timer', () => {
    const fn = vi.fn();
    tokenStorage.onRefreshDue(fn);
    const v = tokenStorage.getVersion();
    tokenStorage.set(res);
    vi.advanceTimersByTime(500_000);
    tokenStorage.set(res);
    expect(tokenStorage.getVersion()).toBe(v + 2);
    vi.advanceTimersByTime(400_000);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(440_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('set broadcasts by default; {broadcast:false} does not', () => {
    tokenStorage.set(res);
    expect(post).toHaveBeenCalledWith({ type: 'token', res });
    post.mockClear();
    tokenStorage.set(res, { broadcast: false });
    expect(post).not.toHaveBeenCalled();
  });

  it("clear broadcasts logout with reason, default 'user'", () => {
    tokenStorage.clear();
    expect(post).toHaveBeenCalledWith({
      type: 'logout',
      reason: 'user',
    });
    tokenStorage.clear({ reason: 'expired' });
    expect(post).toHaveBeenLastCalledWith({
      type: 'logout',
      reason: 'expired',
    });
    post.mockClear();
    tokenStorage.clear({ broadcast: false });
    expect(post).not.toHaveBeenCalled();
  });
});
