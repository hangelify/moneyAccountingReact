import '@/i18n';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { apiClient } from '@/auth/apiClient';
import { SubCategorySelect } from './SubCategorySelect';
import type { SubCategoryRef } from '@/types/bills';

function Wrapper({ children }: { children: ReactNode }): ReactElement {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('SubCategorySelect', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
    vi.restoreAllMocks();
  });

  it('renders grouped options once loaded', async () => {
    mock.onGet('/sub-categories').reply(200, [
      {
        id: '1',
        name: 'milk',
        category_id: 'c1',
        category_name: 'Dairy',
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        name: 'apple',
        category_id: 'c2',
        category_name: 'Fruit',
        created_at: '',
        updated_at: '',
      },
    ]);

    render(
      <Wrapper>
        <SubCategorySelect value={null} onChange={() => undefined} />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'milk' })).toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: 'apple' })).toBeInTheDocument();
  });

  it('emits a SubCategoryRef when a sub-category is picked', async () => {
    mock.onGet('/sub-categories').reply(200, [
      {
        id: '1',
        name: 'milk',
        category_id: 'c1',
        category_name: 'Dairy',
        created_at: '',
        updated_at: '',
      },
    ]);
    const onChange = vi.fn();

    render(
      <Wrapper>
        <SubCategorySelect
          aria-label="Category"
          value={null}
          onChange={onChange}
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'milk' })).toBeInTheDocument();
    });
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Category' }),
      '1'
    );

    expect(onChange).toHaveBeenCalledWith({
      id: '1',
      name: 'milk',
      category_name: 'Dairy',
    } satisfies SubCategoryRef);
  });

  it('emits null when the placeholder is selected', async () => {
    mock.onGet('/sub-categories').reply(200, [
      {
        id: '1',
        name: 'milk',
        category_id: 'c1',
        category_name: 'Dairy',
        created_at: '',
        updated_at: '',
      },
    ]);
    const onChange = vi.fn();

    render(
      <Wrapper>
        <SubCategorySelect
          aria-label="Category"
          value={{ id: '1', name: 'milk', category_name: 'Dairy' }}
          onChange={onChange}
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'milk' })).toBeInTheDocument();
    });
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Category' }),
      ''
    );

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('disables and shows error state with a retry button on failure', async () => {
    mock.onGet('/sub-categories').reply(500);

    render(
      <Wrapper>
        <SubCategorySelect
          aria-label="Category"
          value={null}
          onChange={() => undefined}
        />
      </Wrapper>
    );

    // Wait for the error state specifically — disabled alone is also true
    // during loading, so a disabled-only wait can resolve too early.
    expect(
      await screen.findByRole('button', { name: /retry/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeDisabled();
  });

  it('renders a transient option for the saved value while loading', async () => {
    // Delay the response so we can observe the pending state.
    mock.onGet('/sub-categories').reply(
      () =>
        new Promise<[number, unknown]>((res) => {
          setTimeout(() => res([200, []]), 30);
        })
    );

    render(
      <Wrapper>
        <SubCategorySelect
          aria-label="Category"
          value={{ id: 'x', name: 'cheese', category_name: 'Dairy' }}
          onChange={() => undefined}
        />
      </Wrapper>
    );

    // While pending, the saved value's label should already be rendered as
    // a transient option so the controlled <select> stays in sync.
    const combobox = screen.getByRole('combobox', { name: 'Category' });
    expect(combobox).toBeDisabled();
    expect(
      screen.getByRole('option', { name: /Dairy.*cheese/ })
    ).toBeInTheDocument();
    expect((combobox as HTMLSelectElement).value).toBe('x');

    // Let the request resolve so react-query doesn't leak warnings.
    await waitFor(() => {
      expect(combobox).not.toBeDisabled();
    });
  });
});
