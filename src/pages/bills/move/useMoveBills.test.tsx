import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { billsApi } from '@/api/bills';
import { ApiError } from '@/auth/apiError';
import { toast } from '@/components/ui/use-toast';
import {
  HouseholdTestProvider,
  TEST_HOUSEHOLDS,
  makeHouseholdValue,
} from '@/test/household';
import type { MoveBillsResponse } from '@/types/bills';
import type { Household } from '@/types/households';
import type { MoveBillRef } from './types';
import { useMoveBills } from './useMoveBills';

vi.mock('@/api/bills', () => ({ billsApi: { move: vi.fn() } }));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));

const [, target] = TEST_HOUSEHOLDS as [Household, Household];

const ref = (
  id: string,
  status: 'draft' | 'confirmed' = 'confirmed'
): MoveBillRef => ({
  id,
  status,
  marketName: 'Shop',
  billDate: '2026-11-01',
  total: 10,
  currency: 'EUR',
});

const moved = (
  id: string,
  lostCat = 0,
  lostSub = 0,
  alreadyMoved = false
): MoveBillsResponse['bills'][number] => ({
  id,
  lines_total: 3,
  lines_lost_category: lostCat,
  lines_lost_sub_category: lostSub,
  already_moved: alreadyMoved,
});

function setup(value = makeHouseholdValue()): {
  client: QueryClient;
  wrapper: ({ children }: { children: ReactNode }) => React.JSX.Element;
} {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({
    children,
  }: {
    children: ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={client}>
      <HouseholdTestProvider value={value}>{children}</HouseholdTestProvider>
    </QueryClientProvider>
  );
  return { client, wrapper };
}

const isInvalidated = (client: QueryClient, key: unknown[]): boolean =>
  client.getQueryState(key)?.isInvalidated === true;

function seed(client: QueryClient): void {
  for (const hid of ['hh-1', 'hh-2']) {
    client.setQueryData(['households', hid, 'bills', 'list'], { data: [] });
    client.setQueryData(['households', hid, 'dashboard'], {});
    client.setQueryData(['households', hid, 'markets'], []);
    client.setQueryData(['households', hid, 'bill', 'a'], { id: 'a' });
  }
}

describe('useMoveBills', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts ids and target', async () => {
    const { wrapper } = setup();
    vi.mocked(billsApi.move).mockResolvedValue({
      target_household_id: 'hh-2',
      bills: [moved('a'), moved('b')],
    });
    const { result } = renderHook(() => useMoveBills(), { wrapper });
    await result.current.move([ref('a'), ref('b')], target);
    expect(billsApi.move).toHaveBeenCalledWith('hh-1', {
      bill_ids: ['a', 'b'],
      target_household_id: 'hh-2',
    });
  });

  it('sums lost lines and picks bills with losses', async () => {
    const { wrapper } = setup();
    vi.mocked(billsApi.move).mockResolvedValue({
      target_household_id: 'hh-2',
      bills: [moved('a', 2), moved('b', 0, 1), moved('c')],
    });
    const { result } = renderHook(() => useMoveBills(), { wrapper });
    const outcome = await result.current.move(
      [ref('a'), ref('b', 'draft'), ref('c')],
      target
    );
    expect(outcome.target).toBe(target);
    expect(outcome.lostLines).toBe(2);
    expect(outcome.lostSubLines).toBe(1);
    expect(outcome.withLosses.map((b) => b.id)).toEqual(['a', 'b']);
    expect(outcome.withLosses[1]).toMatchObject({
      status: 'draft',
      marketName: 'Shop',
      lostCategory: 0,
      lostSubCategory: 1,
    });
  });

  it('counts already_moved as moved', async () => {
    const { wrapper } = setup();
    vi.mocked(billsApi.move).mockResolvedValue({
      target_household_id: 'hh-2',
      bills: [moved('a', 0, 0, true), moved('b', 0, 0, true)],
    });
    const { result } = renderHook(() => useMoveBills(), { wrapper });
    const outcome = await result.current.move([ref('a'), ref('b')], target);
    expect(outcome.moved).toHaveLength(2);
    expect(outcome.moved[0]?.alreadyMoved).toBe(true);
    expect(outcome.withLosses).toEqual([]);
  });

  it('invalidates both budgets and target markets on success', async () => {
    const { client, wrapper } = setup();
    seed(client);
    vi.mocked(billsApi.move).mockResolvedValue({
      target_household_id: 'hh-2',
      bills: [moved('a')],
    });
    const { result } = renderHook(() => useMoveBills(), { wrapper });
    await result.current.move([ref('a')], target);
    for (const hid of ['hh-1', 'hh-2']) {
      expect(isInvalidated(client, ['households', hid, 'bills', 'list'])).toBe(
        true
      );
      expect(isInvalidated(client, ['households', hid, 'dashboard'])).toBe(
        true
      );
    }
    expect(isInvalidated(client, ['households', 'hh-2', 'markets'])).toBe(true);
    expect(isInvalidated(client, ['households', 'hh-1', 'markets'])).toBe(
      false
    );
  });

  it('removes source detail and invalidates target detail', async () => {
    const { client, wrapper } = setup();
    seed(client);
    vi.mocked(billsApi.move).mockResolvedValue({
      target_household_id: 'hh-2',
      bills: [moved('a')],
    });
    const { result } = renderHook(() => useMoveBills(), { wrapper });
    await result.current.move([ref('a')], target);
    expect(
      client.getQueryState(['households', 'hh-1', 'bill', 'a'])
    ).toBeUndefined();
    expect(isInvalidated(client, ['households', 'hh-2', 'bill', 'a'])).toBe(
      true
    );
  });

  it('leaves caches on 409', async () => {
    const { client, wrapper } = setup();
    seed(client);
    vi.mocked(billsApi.move).mockRejectedValue(
      new ApiError(409, { conflicts: [{ id: 'a', reason: 'has_duplicates' }] })
    );
    const { result } = renderHook(() => useMoveBills(), { wrapper });
    await expect(result.current.move([ref('a')], target)).rejects.toMatchObject(
      {
        failure: {
          kind: 'conflicts',
          conflicts: [{ id: 'a', reason: 'has_duplicates' }],
        },
      }
    );
    expect(isInvalidated(client, ['households', 'hh-1', 'bills', 'list'])).toBe(
      false
    );
    expect(
      client.getQueryState(['households', 'hh-1', 'bill', 'a'])
    ).toBeDefined();
  });

  it('invalidates on 404', async () => {
    const { client, wrapper } = setup();
    seed(client);
    vi.mocked(billsApi.move).mockRejectedValue(
      new ApiError(404, { bill_ids: ['a'] })
    );
    const { result } = renderHook(() => useMoveBills(), { wrapper });
    await expect(result.current.move([ref('a')], target)).rejects.toMatchObject(
      {
        failure: {
          kind: 'missing',
          ids: ['a'],
        },
      }
    );
    expect(isInvalidated(client, ['households', 'hh-1', 'bills', 'list'])).toBe(
      true
    );
  });

  it('403 refetches budgets and toasts', async () => {
    const value = makeHouseholdValue();
    const { wrapper } = setup(value);
    vi.mocked(billsApi.move).mockRejectedValue(
      new ApiError(403, { message: 'Forbidden' })
    );
    const { result } = renderHook(() => useMoveBills(), { wrapper });
    await expect(result.current.move([ref('a')], target)).rejects.toMatchObject(
      {
        failure: {
          kind: 'forbidden',
        },
      }
    );
    expect(value.refetch).toHaveBeenCalled();
    expect(value.handleForbidden).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('a network error is other', async () => {
    const { wrapper } = setup();
    vi.mocked(billsApi.move).mockRejectedValue(new ApiError(undefined, null));
    const { result } = renderHook(() => useMoveBills(), { wrapper });
    await expect(result.current.move([ref('a')], target)).rejects.toMatchObject(
      {
        failure: {
          kind: 'other',
        },
      }
    );
  });

  it('a second call while pending is rejected without a request', async () => {
    const { wrapper } = setup();
    vi.mocked(billsApi.move).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useMoveBills(), { wrapper });
    void result.current.move([ref('a')], target);
    await expect(result.current.move([ref('a')], target)).rejects.toMatchObject(
      {
        failure: {
          kind: 'other',
        },
      }
    );
    expect(billsApi.move).toHaveBeenCalledTimes(1);
  });
});
