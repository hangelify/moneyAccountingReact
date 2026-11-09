import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { apiClient } from '@/auth/apiClient';
import { useCategoryTree } from './useCategoryTree';
import { HouseholdTestProvider } from '@/test/household';

function Wrapper({ children }: { children: ReactNode }): ReactElement {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <HouseholdTestProvider>{children}</HouseholdTestProvider>
    </QueryClientProvider>
  );
}

const CATEGORIES = '/households/hh-1/categories';
const SUB_CATEGORIES = '/households/hh-1/sub-categories';

const categories = [
  { id: 'c1', name: 'Dairy', created_at: '', updated_at: '' },
  { id: 'c2', name: 'Snacks', created_at: '', updated_at: '' },
];
const subCategories = [
  {
    id: 's1',
    name: 'Cheese',
    category_id: 'c1',
    category_name: 'Dairy',
    created_at: '',
    updated_at: '',
  },
];

describe('useCategoryTree', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  it('builds the tree once both lists load', async () => {
    mock.onGet(CATEGORIES).reply(200, categories);
    mock.onGet(SUB_CATEGORIES).reply(200, subCategories);

    const { result } = renderHook(() => useCategoryTree(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.tree).toEqual([
      { id: 'c1', name: 'Dairy', subs: [{ id: 's1', name: 'Cheese' }] },
      { id: 'c2', name: 'Snacks', subs: [] },
    ]);
  });

  it('is pending until both resolve', async () => {
    mock.onGet(CATEGORIES).reply(200, categories);
    // Never answers.
    mock
      .onGet(SUB_CATEGORIES)
      .reply(() => new Promise<[number]>(() => undefined));

    const { result } = renderHook(() => useCategoryTree(), {
      wrapper: Wrapper,
    });

    await waitFor(() =>
      expect(mock.history.get.map((r) => r.url)).toContain(CATEGORIES)
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.status).toBe('pending');
    expect(result.current.tree).toEqual([]);
  });

  it('is error when only categories fail, and refetch retries it', async () => {
    mock.onGet(CATEGORIES).replyOnce(500);
    mock.onGet(SUB_CATEGORIES).reply(200, subCategories);

    const { result } = renderHook(() => useCategoryTree(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    mock.onGet(CATEGORIES).reply(200, categories);
    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.status).toBe('success'));
    const categoryCalls = mock.history.get.filter((r) => r.url === CATEGORIES);
    expect(categoryCalls).toHaveLength(2);
  });
});
