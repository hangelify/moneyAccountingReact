import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { apiClient } from '@/auth/apiClient';
import { useSubCategories } from './useSubCategories';

function makeWrapper(): {
  Wrapper: ({ children }: { children: ReactNode }) => ReactElement;
  client: QueryClient;
} {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    client,
    Wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

describe('useSubCategories', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
    vi.restoreAllMocks();
  });

  it('groups by category_name and sorts groups + items A-Z', async () => {
    mock.onGet('/sub-categories').reply(200, [
      {
        id: '2',
        name: 'milk',
        category_id: 'c1',
        category_name: 'Dairy',
        created_at: '',
        updated_at: '',
      },
      {
        id: '1',
        name: 'cheese',
        category_id: 'c1',
        category_name: 'Dairy',
        created_at: '',
        updated_at: '',
      },
      {
        id: '3',
        name: 'apple',
        category_id: 'c2',
        category_name: 'Fruit',
        created_at: '',
        updated_at: '',
      },
    ]);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSubCategories(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.groups.map((g) => g.categoryName)).toEqual([
      'Dairy',
      'Fruit',
    ]);
    expect(result.current.groups[0]!.items.map((i) => i.name)).toEqual([
      'cheese',
      'milk',
    ]);
  });

  it('exposes loading then error status on failure', async () => {
    mock.onGet('/sub-categories').reply(500);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSubCategories(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.groups).toEqual([]);
  });
});
