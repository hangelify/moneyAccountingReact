import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { householdsApi } from '@/api/households';
import { TEST_HOUSEHOLDS } from '@/test/household';
import type { Household, HouseholdResponse } from '@/types/households';
import { useUpdateHousehold } from './useUpdateHousehold';

const HH1_RESPONSE: HouseholdResponse = {
  id: 'hh-1',
  name: 'Personal',
  original_name: 'Personal',
  currency: 'EUR',
  role: 'owner',
  created_at: '2026-01-01T00:00:00Z',
  member_count: 1,
};

vi.mock('@/api/households', () => ({
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
    const saved: HouseholdResponse = { ...HH1_RESPONSE, currency: 'MDL' };
    vi.mocked(householdsApi.update).mockResolvedValue(saved);

    const wrapper = ({
      children,
    }: {
      children: ReactNode;
    }): React.JSX.Element => (
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

  it("keeps bill_count and the member's own name semantics", async () => {
    const client = new QueryClient();
    client.setQueryData(['households'], TEST_HOUSEHOLDS);
    vi.mocked(householdsApi.update).mockResolvedValue({
      ...HH1_RESPONSE,
      currency: 'MDL',
    });
    const wrapper = ({
      children,
    }: {
      children: ReactNode;
    }): React.JSX.Element => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateHousehold('hh-1'), {
      wrapper,
    });
    await result.current.mutateAsync({ currency: 'MDL' });
    const row = client.getQueryData<Household[]>(['households'])?.[0];
    expect(row?.bill_count).toBe(12);
    expect(row?.currency).toBe('MDL');
  });
});
