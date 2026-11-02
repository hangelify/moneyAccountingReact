import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { MarketMultiSelect } from './MarketMultiSelect';
import type { ReactElement, ReactNode } from 'react';
import { HouseholdTestProvider } from '@/test/household';

function wrap(ui: ReactNode): ReactElement {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={qc}>
      <HouseholdTestProvider>{ui}</HouseholdTestProvider>
    </QueryClientProvider>
  );
}

describe('MarketMultiSelect', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  it('renders fetched markets and emits names on toggle', async () => {
    mock.onGet('/households/hh-1/markets').reply(200, [
      {
        id: '1',
        name: 'Lidl',
        address: null,
        city: 'Bucharest',
        country: 'RO',
        created_at: '2026-01-10T08:00:00Z',
        bill_count: 12,
      },
      {
        id: '2',
        name: 'Kaufland',
        address: null,
        city: null,
        country: null,
        created_at: '2026-02-01T08:00:00Z',
        bill_count: 3,
      },
    ]);
    const onChange = vi.fn();
    render(
      wrap(
        <MarketMultiSelect
          value={[]}
          onChange={onChange}
          aria-label="Markets"
        />
      )
    );
    await userEvent.click(screen.getByRole('button', { name: /markets/i }));
    await waitFor(() => screen.getByLabelText('Lidl'));
    await userEvent.click(screen.getByLabelText('Lidl'));
    expect(onChange).toHaveBeenCalledWith(['Lidl']);
  });

  it('shows "All markets" when value is empty', () => {
    mock.onGet('/households/hh-1/markets').reply(200, []);
    render(
      wrap(
        <MarketMultiSelect value={[]} onChange={vi.fn()} aria-label="Markets" />
      )
    );
    expect(screen.getByText('All markets')).toBeInTheDocument();
  });

  it('summarizes 1-2 selected names, shows count for 3+', () => {
    mock.onGet('/households/hh-1/markets').reply(200, []);
    const { rerender } = render(
      wrap(
        <MarketMultiSelect
          value={['Lidl', 'Kaufland']}
          onChange={vi.fn()}
          aria-label="Markets"
        />
      )
    );
    expect(screen.getByText(/lidl, kaufland/i)).toBeInTheDocument();
    rerender(
      wrap(
        <MarketMultiSelect
          value={['Lidl', 'Kaufland', 'Mega', 'Auchan']}
          onChange={vi.fn()}
          aria-label="Markets"
        />
      )
    );
    expect(screen.getByText('4 markets')).toBeInTheDocument();
  });

  it('renders a retry button on error', async () => {
    mock.onGet('/households/hh-1/markets').reply(500);
    render(
      wrap(
        <MarketMultiSelect value={[]} onChange={vi.fn()} aria-label="Markets" />
      )
    );
    await userEvent.click(screen.getByRole('button', { name: /markets/i }));
    await waitFor(() => screen.getByRole('button', { name: /retry/i }));
  });
});
