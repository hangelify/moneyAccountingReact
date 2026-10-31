import '@/i18n';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import type { ReactElement } from 'react';
import { apiClient } from '@/auth/apiClient';
import { HouseholdTestProvider, makeHouseholdValue } from '@/test/household';
import { Toaster } from '@/components/ui/toaster';
import { BillDetailPage } from './BillDetailPage';

function LocationProbe(): ReactElement {
  const loc = useLocation();
  return (
    <>
      <span data-testid="loc">{loc.pathname}</span>
      <span data-testid="search">{loc.search}</span>
      <Outlet />
    </>
  );
}

function renderAt(path: string, household = makeHouseholdValue()): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <HouseholdTestProvider value={household}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/bills/confirmed" element={<LocationProbe />}>
              <Route path=":id" element={<BillDetailPage />} />
            </Route>
            <Route path="/bills/drafts" element={<LocationProbe />}>
              <Route path=":id" element={<BillDetailPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
        <Toaster />
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
}

const draftBill = {
  id: 'd1',
  bill_date: '2026-10-28',
  total_amount: 7.2,
  amount_mismatch: false,
  currency: 'EUR',
  created_at: '2026-10-28T10:00:00Z',
  status: 'draft',
  market: { id: 'm1', name: 'Lidl', city: null },
  items: [
    {
      id: 'l1',
      raw_name: 'MILK',
      sub_category: { id: 's1', name: 'milk', category_name: 'Dairy' },
      product_count: 1,
      amount: 2.49,
      product_weight: null,
    },
    {
      id: 'l2',
      raw_name: 'APPLES',
      sub_category: null,
      product_count: 1,
      amount: 4.71,
      product_weight: 0.942,
    },
  ],
};
const DETAIL = '/households/hh-1/bills/d1';
const CONFIRM = '/households/hh-1/bills/d1/confirm';
const confirmButton = (): HTMLElement =>
  screen.getByRole('button', { name: /confirm/i });

describe('BillDetailPage', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  function postedBody(): unknown {
    const post = mock.history.post?.find((r) => r.url === CONFIRM);
    return JSON.parse(String(post?.data));
  }

  it('renders the bill as a page with a heading and items table', async () => {
    mock.onGet(DETAIL).reply(200, draftBill);
    renderAt('/bills/drafts/d1');
    expect(
      await screen.findByRole('heading', { name: 'Bill details' })
    ).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('MILK')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('switches between the items table and the chart', async () => {
    mock.onGet(DETAIL).reply(200, draftBill);
    renderAt('/bills/drafts/d1');
    const items = await screen.findByRole('tab', { name: 'Items' });
    expect(items).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Chart' }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(
      screen.getByRole('button', { name: /^Dairy, €2\.49, 34\.58%$/ })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Chart' })).toBeDisabled();
  });

  it('Back returns to the list keeping the search string', async () => {
    mock.onGet(DETAIL).reply(200, draftBill);
    renderAt('/bills/drafts/d1?page=2');
    await userEvent.click(
      await screen.findByRole('button', { name: /back to list/i })
    );
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent(/^\/bills\/drafts$/)
    );
    expect(screen.getByTestId('search')).toHaveTextContent('?page=2');
  });

  it('Edit turns cells into inputs and Cancel restores them', async () => {
    mock.onGet(DETAIL).reply(200, draftBill);
    renderAt('/bills/drafts/d1');
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const amount = screen.getByLabelText('Item 1 amount');
    await userEvent.clear(amount);
    await userEvent.type(amount, '9');
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByLabelText('Item 1 amount')).toBeNull();
    expect(screen.getByText('2.49 EUR')).toBeInTheDocument();
  });

  it('confirms the edited values', async () => {
    mock.onGet(DETAIL).reply(200, draftBill);
    mock
      .onPost(CONFIRM)
      .reply(200, { ...draftBill, status: 'confirmed', total_amount: 9 });
    renderAt('/bills/drafts/d1');
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const market = screen.getByLabelText('Market');
    await userEvent.clear(market);
    await userEvent.type(market, 'Kaufland');
    const total = screen.getByLabelText('Total');
    await userEvent.clear(total);
    await userEvent.type(total, '9');
    const amount = screen.getByLabelText('Item 1 amount');
    await userEvent.clear(amount);
    await userEvent.type(amount, '4.29');

    await userEvent.click(confirmButton());
    await waitFor(() => expect(screen.queryByLabelText('Market')).toBeNull());
    expect(postedBody()).toMatchObject({
      new_market: { name: 'Kaufland' },
      total_amount: 9,
      items: [{ id: 'l1', amount: 4.29 }, { id: 'l2' }],
    });
    expect(postedBody()).not.toHaveProperty('market_id');
  });

  it('shows the saved bill on 409', async () => {
    mock
      .onGet(DETAIL)
      .replyOnce(200, draftBill)
      .onGet(DETAIL)
      .reply(200, { ...draftBill, status: 'confirmed' });
    mock.onPost(CONFIRM).reply(409, { message: 'already confirmed' });
    renderAt('/bills/drafts/d1');
    await userEvent.click(
      await screen.findByRole('button', { name: /confirm/i })
    );
    expect(
      await screen.findByText('This bill was already confirmed.')
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /confirm/i })).toBeNull()
    );
  });

  it('navigates back to the list on 404', async () => {
    mock.onGet(DETAIL).reply(200, draftBill);
    mock.onPost(CONFIRM).reply(404, {});
    renderAt('/bills/drafts/d1');
    await userEvent.click(
      await screen.findByRole('button', { name: /confirm/i })
    );
    expect(
      await screen.findByText('This draft no longer exists.')
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent(/^\/bills\/drafts$/)
    );
  });

  it('shows not found for a missing bill', async () => {
    mock.onGet(DETAIL).reply(404, {});
    renderAt('/bills/drafts/d1');
    expect(await screen.findByText('Bill not found.')).toBeInTheDocument();
  });

  it('shows loading while the household is not ready yet', () => {
    renderAt(
      '/bills/drafts/d1',
      makeHouseholdValue({ status: 'loading', activeHousehold: null })
    );
    expect(screen.getByText('Loading bill…')).toBeInTheDocument();
  });
});
