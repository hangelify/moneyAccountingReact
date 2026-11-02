import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdown } from './useCountdown';

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('counts down to 0 once per second and stops ticking', () => {
    const { result } = renderHook(() => useCountdown());
    expect(result.current.secondsLeft).toBe(0);
    act(() => result.current.start(3));
    expect(result.current.secondsLeft).toBe(3);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.secondsLeft).toBe(2);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.secondsLeft).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.secondsLeft).toBe(0);
  });

  it('clears interval on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { result, unmount } = renderHook(() => useCountdown());
    act(() => result.current.start(10));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restarting replaces the running countdown', () => {
    const { result } = renderHook(() => useCountdown());
    act(() => result.current.start(5));
    act(() => result.current.start(2));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.secondsLeft).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('start(0) or a negative value starts no interval', () => {
    const { result } = renderHook(() => useCountdown());
    act(() => result.current.start(0));
    expect(result.current.secondsLeft).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    act(() => result.current.start(-5));
    expect(result.current.secondsLeft).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('start(0) stops a running countdown', () => {
    const { result } = renderHook(() => useCountdown());
    act(() => result.current.start(5));
    act(() => result.current.start(0));
    expect(result.current.secondsLeft).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
