// src/pages/bills/BillsCards.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { BillsCards } from './BillsCards';
import { BillDetailDrawer } from './BillDetailDrawer';
import type { BillResponseDto } from '@/types/bills';
import type { ReactElement } from 'react';
import '@/i18n';
import { HouseholdTestProvider, makeHouseholdValue } from '@/test/household';

function LocationProbe(): ReactElement {
  const loc = useLocation();
  return (
    <span data-testid="loc">
      {loc.pathname}
      {loc.search}
    </span>
  );
}

function renderApp(initial: string): void {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={qc}>
      <HouseholdTestProvider value={makeHouseholdValue()}>
        <MemoryRouter initialEntries={[initial]}>
          <LocationProbe />
          <Routes>
            <Route path="/bills" element={<BillsCards />}>
              <Route path=":id" element={<BillDetailDrawer />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
}

function fixture(id: string, market: string): BillResponseDto {
  return {
    id,
    bill_date: '2026-05-19',
    total_amount: 10,
    amount_mismatch: false,
    currency: 'EUR',
    description: null,
    market: { id: `m-${id}`, name: market, city: null },
    created_at: '2026-05-19T10:00:00Z',
    items_count: 3,
  };
}

const page = (bills: BillResponseDto[]): [number, unknown] => [
  200,
  {
    data: bills,
    meta: { total: bills.length, page: 1, limit: 20, total_pages: 1 },
  },
];

describe('BillsCards (integration)', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet('/households/hh-1/markets').reply(200, []);
  });
  afterEach(() => mock.restore());

  it('renders a card per bill and opens the drawer keeping the filters', async () => {
    mock
      .onGet('/households/hh-1/bills')
      .reply(() => page([fixture('b1', 'Lidl'), fixture('b2', 'Kaufland')]));
    mock.onGet('/households/hh-1/bills/b2').reply(200, {
      ...fixture('b2', 'Kaufland'),
      items: [],
    });

    renderApp('/bills?currency=EUR');

    const cards = await screen.findAllByRole('button', { name: /view bill/i });
    expect(cards).toHaveLength(2);
    const target = cards.find((c) => within(c).queryByText('Kaufland'));
    await userEvent.click(target!);

    await waitFor(() => screen.getByText(/bill details/i));
    expect(screen.getByTestId('loc')).toHaveTextContent(
      '/bills/b2?currency=EUR'
    );

    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent(
        /^\/bills\?currency=EUR$/
      )
    );
  });

  it('shows the empty state when there are no bills', async () => {
    mock.onGet('/households/hh-1/bills').reply(() => page([]));
    renderApp('/bills');
    await waitFor(() =>
      screen.getByText(/once you confirm a bill, it will appear here/i)
    );
  });

  it('shows an error with retry when the list fails', async () => {
    mock.onGet('/households/hh-1/bills').replyOnce(500);
    mock
      .onGet('/households/hh-1/bills')
      .reply(() => page([fixture('b1', 'Lidl')]));
    renderApp('/bills');

    await waitFor(() => screen.getByText(/couldn't load bills/i));
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => screen.getByText('Lidl'));
  });
});
