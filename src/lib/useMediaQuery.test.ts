import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';

type Listener = (e: MediaQueryListEvent) => void;
interface FakeMQL extends MediaQueryList {
  _change(matches: boolean): void;
}

function installMatchMedia(initialMatches: boolean): FakeMQL {
  let matches = initialMatches;
  const listeners = new Set<Listener>();
  const mql: FakeMQL = {
    matches,
    media: '(min-width: 768px)',
    onchange: null,
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
    addListener: (cb: Listener) => listeners.add(cb),
    removeListener: (cb: Listener) => listeners.delete(cb),
    dispatchEvent: () => true,
    _change(next) {
      matches = next;
      Object.defineProperty(this, 'matches', {
        value: next,
        configurable: true,
      });
      listeners.forEach((cb) =>
        cb({ matches: next, media: this.media } as MediaQueryListEvent)
      );
    },
  } as FakeMQL;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => mql,
  });
  return mql;
}

describe('useMediaQuery', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    });
  });

  it('returns initial match', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes', () => {
    const mql = installMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
    act(() => mql._change(true));
    expect(result.current).toBe(true);
  });

  it('returns false when matchMedia is undefined (SSR)', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
  });
});
