import type { ReactNode } from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { categoryLimitsApi } from '@/api/categoryLimits';
import type { CategoryLimit } from '@/types/categoryLimits';
import {
  categoryLimitsKey,
  useRemoveCategoryLimit,
  useSaveCategoryLimit,
} from './useCategoryLimits';

vi.mock('@/api/categoryLimits', () => ({
  categoryLimitsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const limit = (overrides: Partial<CategoryLimit> = {}): CategoryLimit => ({
  id: 'l1',
  category_id: 'c1',
  category_name: 'Food',
  category_archived: false,
  period_type: 'MONTHLY',
  amount: 300,
  currency: 'EUR',
  effective_from: '2026-11-01',
  effective_to: null,
  ...overrides,
});

const OTHER = limit({ id: 'l2', category_id: 'c2', category_name: 'Rent' });

function setup(): {
  client: QueryClient;
  wrapper: (p: { children: ReactNode }) => React.JSX.Element;
} {
  const client = new QueryClient();
  client.setQueryData(categoryLimitsKey('hh-1'), [limit(), OTHER]);
  const wrapper = ({
    children,
  }: {
    children: ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('useSaveCategoryLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs when the category has no open limit and appends the result', async () => {
    const { client, wrapper } = setup();
    const created = limit({ id: 'l3', category_id: 'c3', amount: 400 });
    vi.mocked(categoryLimitsApi.create).mockResolvedValue(created);
    const { result } = renderHook(() => useSaveCategoryLimit('hh-1'), {
      wrapper,
    });

    await result.current.mutateAsync({
      categoryId: 'c3',
      hasOpenLimit: false,
      body: { period_type: 'MONTHLY', amount: 400 },
    });

    expect(categoryLimitsApi.create).toHaveBeenCalledWith('hh-1', {
      category_id: 'c3',
      period_type: 'MONTHLY',
      amount: 400,
    });
    expect(categoryLimitsApi.update).not.toHaveBeenCalled();
    expect(client.getQueryData(categoryLimitsKey('hh-1'))).toEqual([
      limit(),
      OTHER,
      created,
    ]);
  });

  it('PUTs when the category has an open limit and replaces it', async () => {
    const { client, wrapper } = setup();
    const updated = limit({ id: 'l9', amount: 450 });
    vi.mocked(categoryLimitsApi.update).mockResolvedValue(updated);
    const { result } = renderHook(() => useSaveCategoryLimit('hh-1'), {
      wrapper,
    });

    await result.current.mutateAsync({
      categoryId: 'c1',
      hasOpenLimit: true,
      body: { period_type: 'MONTHLY', amount: 450 },
    });

    expect(categoryLimitsApi.update).toHaveBeenCalledWith('hh-1', 'c1', {
      period_type: 'MONTHLY',
      amount: 450,
    });
    expect(categoryLimitsApi.create).not.toHaveBeenCalled();
    expect(client.getQueryData(categoryLimitsKey('hh-1'))).toEqual([
      updated,
      OTHER,
    ]);
  });
});

describe('useRemoveCategoryLimit', () => {
  it('DELETEs the limit and stores its end date', async () => {
    const { client, wrapper } = setup();
    const ending = limit({ effective_to: '2026-12-01' });
    vi.mocked(categoryLimitsApi.remove).mockResolvedValue(ending);
    const { result } = renderHook(() => useRemoveCategoryLimit('hh-1'), {
      wrapper,
    });

    await result.current.mutateAsync('c1');

    expect(categoryLimitsApi.remove).toHaveBeenCalledWith('hh-1', 'c1');
    expect(client.getQueryData(categoryLimitsKey('hh-1'))).toEqual([
      ending,
      OTHER,
    ]);
  });
});
