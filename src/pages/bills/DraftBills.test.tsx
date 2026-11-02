// src/pages/bills/DraftBills.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { BillsCards } from './BillsCards';
import { DraftBills } from './DraftBills';
import { BillDetailDrawer } from './BillDetailDrawer';
import type { DraftBillDto } from '@/types/bills';
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
            <Route path="/bills/drafts" element={<DraftBills />}>
              <Route path=":id" element={<BillDetailDrawer />} />
            </Route>
            <Route path="/bills" element={<BillsCards />}>
              <Route path=":id" element={<BillDetailDrawer />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
}

function draft(id: string, rawMarket: string): DraftBillDto {
  return {
    id,
    bill_date: '2026-05-19',
    total_amount: 10,
    amount_mismatch: false,
    created_at: '2026-05-19T10:00:00Z',
    status: 'draft',
    market_name_raw: rawMarket,
    bill_date_inferred: false,
    items: [
      {
        id: `${id}-i1`,
        raw_name: 'BUN',
        sub_category: null,
        product_count: 1,
        amount: 10,
      },
    ],
  };
}

const paged = <T,>(rows: T[], page = 1, totalPages = 1): [number, unknown] => [
  200,
  {
    data: rows,
    meta: { total: rows.length, page, limit: 20, total_pages: totalPages },
  },
];

describe('DraftBills (integration)', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet('/households/hh-1/markets').reply(200, []);
  });
  afterEach(() => mock.restore());

  it('lists drafts as cards and opens one in the drawer', async () => {
    mock
      .onGet('/households/hh-1/bills/drafts')
      .reply(() => paged([draft('d1', 'LIDL SRL'), draft('d2', 'MEGA SRL')]));
    mock.onGet('/households/hh-1/bills/d2').reply(200, {
      ...draft('d2', 'MEGA SRL'),
      items: [],
    });

    renderApp('/bills/drafts');

    const cards = await screen.findAllByRole('button', { name: /view bill/i });
    expect(cards).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: /to review \(2\)/i })
    ).toBeInTheDocument();
    // Drafts take no filters.
    expect(screen.queryByLabelText(/min amount/i)).toBeNull();

    await userEvent.click(
      cards.find((c) => within(c).queryByText('MEGA SRL'))!
    );
    await waitFor(() => screen.getByText(/bill details/i));
    expect(screen.getByTestId('loc')).toHaveTextContent('/bills/drafts/d2');
  });

  it('pages through drafts with ?page', async () => {
    mock.onGet('/households/hh-1/bills/drafts').reply((config) => {
      const p = config.params as { page: number };
      return p.page === 2
        ? paged([draft('d21', 'PAGE TWO')], 2, 2)
        : paged([draft('d1', 'PAGE ONE')], 1, 2);
    });

    renderApp('/bills/drafts');
    await waitFor(() => screen.getByText('PAGE ONE'));
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByText('PAGE TWO'));
    expect(screen.getByTestId('loc')).toHaveTextContent('/bills/drafts?page=2');
  });

  it('shows its own empty state', async () => {
    mock.onGet('/households/hh-1/bills/drafts').reply(() => paged([]));
    renderApp('/bills/drafts');
    await waitFor(() => screen.getByText(/no bills waiting for review/i));
  });

  it('points an empty Bills tab to the drafts waiting for review', async () => {
    mock.onGet('/households/hh-1/bills').reply(() => paged([]));
    mock
      .onGet('/households/hh-1/bills/drafts')
      .reply(() => paged([draft('d1', 'A'), draft('d2', 'B')]));

    renderApp('/bills');

    const link = await screen.findByRole('link', {
      name: /you have 2 bills to review/i,
    });
    await userEvent.click(link);
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent(/^\/bills\/drafts$/)
    );
  });
});
