import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AuthChannelModule from '@/auth/authChannel';
import type { AuthMessage } from '@/auth/authChannel';

type Listener = (ev: { data: unknown }) => void;

const buses = new Map<string, Set<FakeChannel>>();

class FakeChannel {
  private listeners = new Set<Listener>();
  private name: string;
  constructor(name: string) {
    this.name = name;
    const set = buses.get(name) ?? new Set<FakeChannel>();
    set.add(this);
    buses.set(name, set);
  }
  postMessage(data: unknown): void {
    for (const ch of buses.get(this.name) ?? []) {
      if (ch === this) continue;
      ch.listeners.forEach((l) => l({ data }));
    }
  }
  addEventListener(_t: string, l: Listener): void {
    this.listeners.add(l);
  }
  removeEventListener(_t: string, l: Listener): void {
    this.listeners.delete(l);
  }
}

type Mod = typeof AuthChannelModule;

describe('authChannel', () => {
  beforeEach(() => {
    buses.clear();
    vi.resetModules();
    vi.stubGlobal('BroadcastChannel', FakeChannel);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delivers posted messages to subscribers in another channel instance', async () => {
    const a: Mod = await import('@/auth/authChannel');
    vi.resetModules();
    const b: Mod = await import('@/auth/authChannel');
    const handler = vi.fn();
    b.authChannel.subscribe(handler);
    const msg: AuthMessage = { type: 'logout', reason: 'user' };
    a.authChannel.post(msg);
    expect(handler).toHaveBeenCalledWith(msg);
  });

  it('does not deliver to its own subscribers', async () => {
    const a: Mod = await import('@/auth/authChannel');
    const handler = vi.fn();
    a.authChannel.subscribe(handler);
    a.authChannel.post({ type: 'logout', reason: 'expired' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('stops delivering after unsubscribe', async () => {
    const a: Mod = await import('@/auth/authChannel');
    vi.resetModules();
    const b: Mod = await import('@/auth/authChannel');
    const handler = vi.fn();
    const off = b.authChannel.subscribe(handler);
    off();
    a.authChannel.post({ type: 'logout', reason: 'revoked' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('is a no-op without BroadcastChannel', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const a: Mod = await import('@/auth/authChannel');
    expect(() =>
      a.authChannel.post({ type: 'logout', reason: 'user' })
    ).not.toThrow();
    expect(typeof a.authChannel.subscribe(vi.fn())).toBe('function');
  });
});
