import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { householdsApi } from '@/pages/households/api';
import { TEST_HOUSEHOLDS } from '@/test/household';
import type { Household } from '@/types/households';
import { useUpdateHousehold } from './useUpdateHousehold';

vi.mock('@/pages/households/api', () => ({
  householdsApi: { update: vi.fn() },
}));

describe('useUpdateHousehold', () => {
  it('replaces the household in the list cache and invalidates household queries', async () => {
    const client = new QueryClient();
    client.setQueryData(['households'], TEST_HOUSEHOLDS);
    const billsKey = ['households', 'hh-1', 'bills', {}, 1, 20];
    const otherKey = ['households', 'hh-2', 'bills', {}, 1, 20];
    client.setQueryData(billsKey, { data: [] });
    client.setQueryData(otherKey, { data: [] });
    const saved = { ...TEST_HOUSEHOLDS[0], currency: 'MDL' } as Household;
    vi.mocked(householdsApi.update).mockResolvedValue(saved);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateHousehold('hh-1'), {
      wrapper,
    });
    await result.current.mutateAsync({ currency: 'MDL' });

    expect(householdsApi.update).toHaveBeenCalledWith('hh-1', {
      currency: 'MDL',
    });
    const list = client.getQueryData<Household[]>(['households']);
    expect(list?.[0]?.currency).toBe('MDL');
    expect(list?.[1]).toBe(TEST_HOUSEHOLDS[1]);
    expect(client.getQueryState(billsKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(otherKey)?.isInvalidated).toBe(false);
  });
});
