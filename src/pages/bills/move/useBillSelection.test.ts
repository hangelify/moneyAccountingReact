import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBillSelection } from './useBillSelection';

const ids = (set: ReadonlySet<string>): string[] =>
  [...set].sort((a, b) => a.localeCompare(b));

describe('useBillSelection', () => {
  it('toggle adds and removes', () => {
    const { result } = renderHook(() => useBillSelection('k'));
    act(() => result.current.start());
    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('b'));
    expect(ids(result.current.selected)).toEqual(['a', 'b']);
    act(() => result.current.toggle('a'));
    expect(ids(result.current.selected)).toEqual(['b']);
  });

  it('setMany selects and deselects a group', () => {
    const { result } = renderHook(() => useBillSelection('k'));
    act(() => result.current.start());
    act(() => result.current.setMany(['a', 'b', 'c'], true));
    expect(ids(result.current.selected)).toEqual(['a', 'b', 'c']);
    act(() => result.current.setMany(['a', 'b'], false));
    expect(ids(result.current.selected)).toEqual(['c']);
  });

  it('unselect removes only given ids', () => {
    const { result } = renderHook(() => useBillSelection('k'));
    act(() => result.current.start());
    act(() => result.current.setMany(['a', 'b'], true));
    act(() => result.current.unselect(['a', 'zzz']));
    expect(ids(result.current.selected)).toEqual(['b']);
    expect(result.current.selecting).toBe(true);
  });

  it('cancel leaves selection mode and clears', () => {
    const { result } = renderHook(() => useBillSelection('k'));
    act(() => result.current.start());
    act(() => result.current.toggle('a'));
    act(() => result.current.cancel());
    expect(result.current.selecting).toBe(false);
    expect(result.current.selected.size).toBe(0);
  });

  it('a new resetKey clears and leaves selection mode', () => {
    const { result, rerender } = renderHook(
      ({ key }) => useBillSelection(key),
      { initialProps: { key: 'p1' } }
    );
    act(() => result.current.start());
    act(() => result.current.toggle('a'));
    rerender({ key: 'p2' });
    expect(result.current.selecting).toBe(false);
    expect(result.current.selected.size).toBe(0);
  });

  it('going back to the old key does not restore the old selection', () => {
    const { result, rerender } = renderHook(
      ({ key }) => useBillSelection(key),
      { initialProps: { key: 'p1' } }
    );
    act(() => result.current.start());
    act(() => result.current.toggle('a'));
    rerender({ key: 'p2' });
    rerender({ key: 'p1' });
    expect(result.current.selecting).toBe(false);
    expect(result.current.selected.size).toBe(0);
  });
});
