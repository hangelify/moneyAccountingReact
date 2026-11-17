// Moving one bill from its detail (drawer on mobile, page on desktop).
import '@/i18n';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import type { ReactElement } from 'react';
import { apiClient } from '@/auth/apiClient';
import { Toaster } from '@/components/ui/toaster';
import {
  HouseholdTestProvider,
  TEST_HOUSEHOLDS,
  makeHouseholdValue,
} from '@/test/household';
import { mockMatchMedia } from '@/test/matchMedia';
import type { HouseholdContextValue } from '@/contexts/HouseholdContext';
import { BillsCards } from './BillsCards';
import { DraftBills } from './DraftBills';
import { BillDetailRoute } from './BillDetailRoute';

function Where(): ReactElement {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname}</span>;
}

function renderAt(path: string, household = makeHouseholdValue()): void {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={qc}>
      <HouseholdTestProvider value={household}>
        <MemoryRouter initialEntries={[path]}>
          <Where />
          <Routes>
            <Route path="/bills" element={<BillsCards />}>
              <Route path=":id" element={<BillDetailRoute />} />
            </Route>
            <Route path="/bills/drafts" element={<DraftBills />}>
              <Route path=":id" element={<BillDetailRoute />} />
            </Route>
          </Routes>
        </MemoryRouter>
        <Toaster />
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
}

const items = [
  {
    id: 'l1',
    raw_name: 'MILK',
    sub_category: { id: 's1', name: 'milk', category_name: 'Dairy' },
    product_count: 1,
    amount: 2.5,
    product_weight: null,
  },
];

const detail = (id: string, status: string, extra: object = {}): object => ({
  id,
  bill_date: '2026-10-28',
  total_amount: 2.5,
  amount_mismatch: false,
  currency: 'EUR',
  created_at: '2026-10-28T10:00:00Z',
  status,
  market: { id: 'm1', name: 'Lidl', city: null },
  items,
  ...extra,
});

const paged = (data: unknown[]): [number, unknown] => [
  200,
  { data, meta: { total: data.length, page: 1, limit: 20, total_pages: 1 } },
];

const movedReply = (id: string, lost = 0): [number, unknown] => [
  200,
  {
    target_household_id: 'hh-2',
    bills: [
      {
        id,
        lines_total: 1,
        lines_lost_category: lost,
        lines_lost_sub_category: 0,
        already_moved: false,
      },
    ],
  },
];

async function moveTo(name = /family budget/i): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', { name: /move to budget/i })
  );
  const dialog = await screen.findByRole('dialog', { name: /move 1 bill/i });
  await userEvent.click(within(dialog).getByRole('radio', { name }));
  await userEvent.click(
    within(dialog).getByRole('button', { name: /^move$/i })
  );
}

describe('moving a bill from its detail', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet(/\/markets$/).reply(200, []);
    mock.onGet('/households/hh-1/bills').reply(() => paged([]));
    mock.onGet('/households/hh-1/bills/drafts').reply(() => paged([]));
    mock
      .onGet('/households/hh-1/bills/c1')
      .reply(200, detail('c1', 'confirmed'));
    mock.onGet('/households/hh-1/bills/d1').reply(200, detail('d1', 'draft'));
  });
  afterEach(() => mock.restore());

  it('has no Move with one budget', async () => {
    renderAt(
      '/bills/c1',
      makeHouseholdValue({ households: TEST_HOUSEHOLDS.slice(0, 1) })
    );
    await screen.findByRole('button', { name: /delete/i });
    expect(
      screen.queryByRole('button', { name: /move to budget/i })
    ).toBeNull();
  });

  it('has no Move for failed and duplicate bills', async () => {
    mock
      .onGet('/households/hh-1/bills/f1')
      .reply(200, detail('f1', 'failed', { items: [] }));
    mock.onGet('/households/hh-1/bills/x1').reply(
      200,
      detail('x1', 'duplicate', {
        duplicate_of: {
          id: 'c1',
          bill_date: '2026-10-28',
          total_amount: 2.5,
          currency: 'EUR',
          market_name: 'Lidl',
          created_by_name: 'Ann',
        },
      })
    );
    renderAt('/bills/x1');
    await screen.findByRole('button', { name: /delete/i });
    expect(
      screen.queryByRole('button', { name: /move to budget/i })
    ).toBeNull();
  });

  it('Move is disabled with unsaved edits and shows the hint', async () => {
    renderAt('/bills/c1');
    await userEvent.click(
      await screen.findByRole('button', { name: /^edit$/i })
    );
    expect(
      screen.getByRole('button', { name: /move to budget/i })
    ).toBeDisabled();
    expect(
      screen.getByText(/save or cancel your changes first/i)
    ).toBeVisible();
  });

  it('Move is disabled with a pending duplicate mark', async () => {
    mock.onGet('/households/hh-1/bills/d1').reply(
      200,
      detail('d1', 'draft', {
        possible_duplicates: [
          {
            id: 'c9',
            bill_date: '2026-10-28',
            total_amount: 2.5,
            currency: 'EUR',
            market_name: 'Lidl',
            created_by_name: 'Ann',
            match: 'weak',
          },
        ],
      })
    );
    renderAt('/bills/drafts/d1');
    await userEvent.click(
      await screen.findByRole('button', { name: /mark as duplicate/i })
    );
    expect(
      screen.getByRole('button', { name: /move to budget/i })
    ).toBeDisabled();
  });

  it('moving a confirmed bill closes the detail and toasts with Open', async () => {
    mock.onPost('/households/hh-1/bills/move').reply(() => movedReply('c1'));
    renderAt('/bills/c1');
    await moveTo();
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent(/^\/bills$/)
    );
    expect(
      await screen.findByText('Moved 1 bill to “Family Budget”')
    ).toBeVisible();
    expect(JSON.parse(mock.history.post[0]?.data as string)).toEqual({
      bill_ids: ['c1'],
      target_household_id: 'hh-2',
    });
  });

  it('Open after moving a draft goes to the drafts route of the target', async () => {
    const household: HouseholdContextValue = makeHouseholdValue();
    mock.onPost('/households/hh-1/bills/move').reply(() => movedReply('d1'));
    renderAt('/bills/drafts/d1', household);
    await moveTo();
    await userEvent.click(
      await screen.findByRole('button', { name: /^open$/i })
    );
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent('/bills/drafts/d1')
    );
    expect(household.setActiveHouseholdId).toHaveBeenCalledWith('hh-2');
  });

  it('desktop: the losses dialog stays open after the detail closes', async () => {
    const media = mockMatchMedia(true);
    try {
      mock
        .onPost('/households/hh-1/bills/move')
        .reply(() => movedReply('c1', 1));
      renderAt('/bills/c1');
      await moveTo();
      expect(
        await screen.findByRole('heading', {
          name: /moved to “family budget”/i,
        })
      ).toBeVisible();
      await waitFor(() =>
        expect(screen.getByTestId('loc')).toHaveTextContent(/^\/bills$/)
      );
      expect(screen.getByText(/1 without category/i)).toBeVisible();
    } finally {
      media.restore();
    }
  });

  it('409 shows the conflicts dialog over the open detail', async () => {
    mock
      .onPost('/households/hh-1/bills/move')
      .reply(409, { conflicts: [{ id: 'c1', reason: 'has_duplicates' }] });
    renderAt('/bills/c1');
    await moveTo();
    expect(
      await screen.findByRole('heading', { name: /nothing was moved/i })
    ).toBeVisible();
    expect(screen.getByTestId('loc')).toHaveTextContent('/bills/c1');
    expect(screen.queryByRole('button', { name: /unselect/i })).toBeNull();
  });

  it('404 toasts and closes', async () => {
    mock.onPost('/households/hh-1/bills/move').reply(404, { bill_ids: ['c1'] });
    renderAt('/bills/c1');
    await moveTo();
    expect(
      await screen.findByText('This bill is no longer here')
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent(/^\/bills$/)
    );
  });
});
