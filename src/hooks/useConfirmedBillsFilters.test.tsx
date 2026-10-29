import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';
import { useConfirmedBillsFilters } from './useConfirmedBillsFilters';

function makeWrapper(
  initial: string
): (p: { children: ReactNode }) => ReactElement {
  return ({ children }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
}

function useHookAndLocation() {
  const hook = useConfirmedBillsFilters();
  const loc = useLocation();
  return { hook, loc };
}

describe('useConfirmedBillsFilters', () => {
  it('parses filters and pagination from URL', () => {
    const { result } = renderHook(useHookAndLocation, {
      wrapper: makeWrapper('/bills/confirmed?currency=EUR&page=2'),
    });
    expect(result.current.hook.filters.currency).toBe('EUR');
    expect(result.current.hook.page).toBe(2);
    expect(result.current.hook.limit).toBe(20);
  });

  it('setFilters resets page to 1 and emits clean URL', () => {
    const { result } = renderHook(useHookAndLocation, {
      wrapper: makeWrapper('/bills/confirmed?page=5'),
    });
    act(() => {
      result.current.hook.setFilters({
        ...result.current.hook.filters,
        currency: 'USD',
      });
    });
    const sp = new URLSearchParams(result.current.loc.search);
    expect(sp.get('currency')).toBe('USD');
    expect(sp.get('page')).toBe('1');
  });

  it('setPage updates page and preserves filters', () => {
    const { result } = renderHook(useHookAndLocation, {
      wrapper: makeWrapper('/bills/confirmed?currency=EUR'),
    });
    act(() => result.current.hook.setPage(3));
    const sp = new URLSearchParams(result.current.loc.search);
    expect(sp.get('page')).toBe('3');
    expect(sp.get('currency')).toBe('EUR');
  });

  it('clearFilters strips filter params, keeps page=1', () => {
    const { result } = renderHook(useHookAndLocation, {
      wrapper: makeWrapper(
        '/bills/confirmed?currency=EUR&market_names=Lidl&page=4'
      ),
    });
    act(() => result.current.hook.clearFilters());
    const sp = new URLSearchParams(result.current.loc.search);
    expect(sp.get('currency')).toBeNull();
    expect(sp.getAll('market_names')).toEqual([]);
    expect(sp.get('page')).toBe('1');
  });

  it('safely coerces junk URL to defaults', () => {
    const { result } = renderHook(useHookAndLocation, {
      wrapper: makeWrapper('/bills/confirmed?currency=ZZZ&page=abc'),
    });
    expect(result.current.hook.filters.currency).toBeNull();
    expect(result.current.hook.page).toBe(1);
  });
});
