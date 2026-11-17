import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { householdsApi } from '@/api/households';
import { ApiError } from '@/auth/apiError';
import { TEST_HOUSEHOLDS } from '@/test/household';
import type { Household } from '@/types/households';
import {
  useCreateHousehold,
  useDeleteHousehold,
  useUpdateMyHouseholdName,
} from './useHouseholdMutations';

vi.mock('@/api/households', () => ({
  householdsApi: { create: vi.fn(), updateMine: vi.fn(), remove: vi.fn() },
}));

function setup(): {
  client: QueryClient;
  wrapper: ({ children }: { children: ReactNode }) => React.JSX.Element;
} {
  const client = new QueryClient();
  client.setQueryData(['households'], TEST_HOUSEHOLDS);
  const wrapper = ({
    children,
  }: {
    children: ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('household mutations', () => {
  it('create appends the new household as owner with zero bills before refetch', async () => {
    const { client, wrapper } = setup();
    vi.mocked(householdsApi.create).mockResolvedValue({
      id: 'hh-3',
      name: 'Trip',
      original_name: 'Trip',
      currency: 'EUR',
      created_at: '2026-03-01T00:00:00Z',
      member_count: 1,
    });
    const { result } = renderHook(() => useCreateHousehold(), { wrapper });
    await result.current.mutateAsync({ name: 'Trip', currency: 'EUR' });

    const list = client.getQueryData<Household[]>(['households']);
    expect(list).toHaveLength(3);
    expect(list?.[2]).toMatchObject({
      id: 'hh-3',
      role: 'owner',
      bill_count: 0,
    });
    expect(client.getQueryState(['households'])?.isInvalidated).toBe(true);
  });

  it('updateMine merges the new name', async () => {
    const { client, wrapper } = setup();
    const billsKey = ['households', 'hh-2', 'bills'];
    client.setQueryData(billsKey, { data: [] });
    vi.mocked(householdsApi.updateMine).mockResolvedValue({
      id: 'hh-2',
      name: 'Mine',
      original_name: 'Family Budget',
      currency: 'MDL',
      created_at: '2026-02-01T00:00:00Z',
      member_count: 3,
    });
    const { result } = renderHook(() => useUpdateMyHouseholdName('hh-2'), {
      wrapper,
    });
    await result.current.mutateAsync({ display_name: 'Mine' });

    const row = client.getQueryData<Household[]>(['households'])?.[1];
    expect(row?.name).toBe('Mine');
    expect(row?.original_name).toBe('Family Budget');
    expect(row?.role).toBe('member');
    expect(client.getQueryState(billsKey)?.isInvalidated).toBe(false);
  });

  it('delete removes the row and the household queries', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(['households', 'hh-1', 'bills'], { data: [] });
    client.setQueryData(['households', 'hh-2', 'bills'], { data: [] });
    vi.mocked(householdsApi.remove).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteHousehold(), { wrapper });
    await result.current.mutateAsync('hh-1');

    const list = client.getQueryData<Household[]>(['households']);
    expect(list?.map((h) => h.id)).toEqual(['hh-2']);
    expect(
      client.getQueryState(['households', 'hh-1', 'bills'])
    ).toBeUndefined();
    expect(client.getQueryState(['households', 'hh-2', 'bills'])).toBeDefined();
  });

  it('delete of a budget that is already gone (404) drops it and refetches the list', async () => {
    const { client, wrapper } = setup();
    client.setQueryData(['households', 'hh-1', 'bills'], { data: [] });
    vi.mocked(householdsApi.remove).mockRejectedValue(
      new ApiError(404, null, {}, 'Not Found')
    );
    const { result } = renderHook(() => useDeleteHousehold(), { wrapper });
    await result.current.mutateAsync('hh-1');

    const list = client.getQueryData<Household[]>(['households']);
    expect(list?.map((h) => h.id)).toEqual(['hh-2']);
    expect(
      client.getQueryState(['households', 'hh-1', 'bills'])
    ).toBeUndefined();
    expect(client.getQueryState(['households'])?.isInvalidated).toBe(true);
  });

  it('delete still fails on other errors', async () => {
    const { client, wrapper } = setup();
    vi.mocked(householdsApi.remove).mockRejectedValue(
      new ApiError(500, null, {}, 'Server Error')
    );
    const { result } = renderHook(() => useDeleteHousehold(), { wrapper });
    await expect(result.current.mutateAsync('hh-1')).rejects.toThrow();
    expect(client.getQueryData<Household[]>(['households'])).toHaveLength(2);
  });

  it('all mutations are flagged ownForbidden', async () => {
    const { client, wrapper } = setup();
    vi.mocked(householdsApi.create).mockResolvedValue({
      id: 'x',
      name: 'x',
      original_name: 'x',
      currency: 'EUR',
      created_at: '',
      member_count: 1,
    });
    vi.mocked(householdsApi.updateMine).mockResolvedValue({
      id: 'hh-2',
      name: 'Family Budget',
      original_name: 'Family Budget',
      currency: 'MDL',
      created_at: '',
      member_count: 3,
    });
    vi.mocked(householdsApi.remove).mockResolvedValue(undefined);
    const a = renderHook(() => useCreateHousehold(), { wrapper });
    const b = renderHook(() => useUpdateMyHouseholdName('hh-2'), { wrapper });
    const c = renderHook(() => useDeleteHousehold(), { wrapper });
    await a.result.current.mutateAsync({ name: 'x', currency: 'EUR' });
    await b.result.current.mutateAsync({ display_name: null });
    await c.result.current.mutateAsync('hh-1');

    const all = client.getMutationCache().getAll();
    expect(all).toHaveLength(3);
    for (const m of all) {
      expect(m.options.meta?.ownForbidden).toBe(true);
    }
  });
});
