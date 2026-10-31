import '@/i18n';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import type { ReactElement } from 'react';
import { apiClient } from '@/auth/apiClient';
import { HouseholdTestProvider } from '@/test/household';
import { mockMatchMedia } from '@/test/matchMedia';
import type { DraftBillDto } from '@/types/bills';
import { DraftBills } from './DraftBills';
import { ConfirmedBills } from './ConfirmedBills';
import { BillDetailRoute } from './BillDetailRoute';

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
      <HouseholdTestProvider>
        <MemoryRouter initialEntries={[initial]}>
          <LocationProbe />
          <Routes>
            <Route path="/bills/drafts" element={<DraftBills />}>
              <Route path=":id" element={<BillDetailRoute />} />
            </Route>
            <Route path="/bills/confirmed" element={<ConfirmedBills />}>
              <Route path=":id" element={<BillDetailRoute />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
}

const draft: DraftBillDto = {
  id: 'd1',
  bill_date: '2026-05-19',
  total_amount: 10,
  amount_mismatch: false,
  created_at: '2026-05-19T10:00:00Z',
  status: 'draft',
  market_name_raw: 'LIDL SRL',
  bill_date_inferred: false,
  items: [
    {
      id: 'i1',
      raw_name: 'BUN',
      sub_category: null,
      product_count: 1,
      amount: 10,
    },
  ],
};
const detail = {
  ...draft,
  items: [{ ...draft.items[0], product_weight: null }],
};
const page = (rows: unknown[]): [number, unknown] => [
  200,
  {
    data: rows,
    meta: { total: rows.length, page: 1, limit: 20, total_pages: 1 },
  },
];

describe('BillDetailRoute', () => {
  let mock: MockAdapter;
  let mm: ReturnType<typeof mockMatchMedia> | null = null;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet('/households/hh-1/markets').reply(200, []);
    mock.onGet('/households/hh-1/bills/drafts').reply(() => page([draft]));
    mock.onGet('/households/hh-1/bills/d1').reply(200, detail);
  });
  afterEach(() => {
    mock.restore();
    mm?.restore();
    mm = null;
  });

  const listCard = (): HTMLElement | null =>
    screen.queryByRole('button', { name: /view bill/i, hidden: true });

  it('desktop: shows the page and hides the list', async () => {
    mm = mockMatchMedia(true);
    renderApp('/bills/drafts/d1');
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(listCard()).toBeNull();
  });

  it('mobile: shows the list with the drawer', async () => {
    mm = mockMatchMedia(false);
    renderApp('/bills/drafts/d1');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await waitFor(() => expect(listCard()).not.toBeNull());
  });

  it('switches layout on resize and keeps the bill', async () => {
    mm = mockMatchMedia(true);
    renderApp('/bills/drafts/d1');
    await screen.findByRole('table');
    act(() => mm!.setMatches(false));
    const dialog = await screen.findByRole('dialog');
    expect(await screen.findByText(/uncategorized/i)).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
    expect(screen.getByTestId('loc')).toHaveTextContent('/bills/drafts/d1');
  });

  it('desktop list without a bill still shows the list', async () => {
    mm = mockMatchMedia(true);
    renderApp('/bills/drafts');
    await waitFor(() => expect(listCard()).not.toBeNull());
  });

  it('desktop: confirmed list (BillsListPage) is hidden while a bill is open', async () => {
    mm = mockMatchMedia(true);
    mock.onGet('/households/hh-1/bills').reply(() => page([]));
    mock.onGet('/households/hh-1/bills/b1').reply(200, {
      ...detail,
      id: 'b1',
      status: 'confirmed',
    });
    renderApp('/bills/confirmed/b1?currency=EUR');
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByLabelText('Currency')).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: /back to list/i })
    );
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent(
        '/bills/confirmed?currency=EUR'
      )
    );
    expect(await screen.findByLabelText('Currency')).toBeInTheDocument();
  });

  it('desktop: opens the page at the top with its heading focused, and Back restores the list', async () => {
    mm = mockMatchMedia(true);
    const scrollTo = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 400,
    });
    try {
      renderApp('/bills/drafts');
      await waitFor(() => expect(listCard()).not.toBeNull());
      await userEvent.click(listCard()!);

      const heading = await screen.findByRole('heading', {
        name: 'Bill details',
      });
      expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
      expect(heading).toHaveFocus();

      await userEvent.click(
        screen.getByRole('button', { name: /back to list/i })
      );
      await waitFor(() => expect(listCard()).not.toBeNull());
      await waitFor(() => expect(scrollTo).toHaveBeenLastCalledWith(0, 400));
      expect(listCard()).toHaveFocus();
    } finally {
      scrollTo.mockRestore();
      Object.defineProperty(window, 'scrollY', {
        configurable: true,
        value: 0,
      });
    }
  });
});
