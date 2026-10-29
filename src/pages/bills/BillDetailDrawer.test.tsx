// src/pages/bills/BillDetailDrawer.test.tsx
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
import { apiClient } from '@/auth/apiClient';
import { BillDetailDrawer } from './BillDetailDrawer';
import type { ReactElement } from 'react';
import { HouseholdTestProvider } from '@/test/household';

function LocationProbe(): ReactElement {
  const loc = useLocation();
  return (
    <>
      <span data-testid="loc">{loc.pathname}</span>
      <Outlet />
    </>
  );
}

function renderAt(path: string): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <HouseholdTestProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/bills/confirmed" element={<LocationProbe />}>
              <Route path=":id" element={<BillDetailDrawer />} />
            </Route>
            <Route path="/bills/drafts" element={<LocationProbe />}>
              <Route path=":id" element={<BillDetailDrawer />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
}

describe('BillDetailDrawer', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  it('opens for /bills/confirmed/:id and renders detail content', async () => {
    mock.onGet('/households/hh-1/bills/b1').reply(200, {
      id: 'b1',
      bill_date: '2026-05-19T00:00:00Z',
      total_amount: 10,
      currency: 'EUR',
      description: null,
      market: null,
      created_at: '2026-05-19T10:00:00Z',
      items: [],
    });
    renderAt('/bills/confirmed/b1');
    await waitFor(() => screen.getByText(/bill details/i));
  });

  it('navigates back to parent route when closed via Esc', async () => {
    mock.onGet('/households/hh-1/bills/b1').reply(200, {
      id: 'b1',
      bill_date: '2026-05-19T00:00:00Z',
      total_amount: 10,
      currency: 'EUR',
      description: null,
      market: null,
      created_at: '2026-05-19T10:00:00Z',
      items: [],
    });
    renderAt('/bills/confirmed/b1');
    await waitFor(() => screen.getByText(/bill details/i));
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent('/bills/confirmed')
    );
  });

  it('shows Confirm and Remove actions for a draft bill', async () => {
    mock.onGet('/households/hh-1/bills/d1').reply(200, {
      id: 'd1',
      bill_date: '2026-10-29',
      total_amount: 3,
      amount_mismatch: false,
      created_at: '2026-10-29T14:03:44.885Z',
      status: 'draft',
      market_name_raw: 'N-1 Supermarket',
      items: [],
    });
    renderAt('/bills/drafts/d1');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /confirm/i })
      ).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('hides Confirm for an already confirmed bill', async () => {
    mock.onGet('/households/hh-1/bills/b1').reply(200, {
      id: 'b1',
      bill_date: '2026-05-19T00:00:00Z',
      total_amount: 10,
      amount_mismatch: false,
      created_at: '2026-05-19T10:00:00Z',
      market: null,
      items: [],
    });
    renderAt('/bills/confirmed/b1');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /remove/i })
      ).toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: /confirm/i })).toBeNull();
  });

  const editableBill = {
    id: 'b1',
    bill_date: '2026-05-19T00:00:00Z',
    total_amount: 10,
    amount_mismatch: false,
    currency: 'EUR',
    created_at: '2026-05-19T10:00:00Z',
    market: { id: 'm1', name: 'Lidl', city: null },
    items: [
      {
        sub_category: { id: 's1', name: 'milk', category_name: 'Dairy' },
        product_count: 1,
        amount: 10,
        product_weight: null,
      },
    ],
  };

  const subCategories = [
    { id: 's1', name: 'milk', category_name: 'Dairy' },
    { id: 's2', name: 'cheese', category_name: 'Dairy' },
  ].map((sc) => ({
    ...sc,
    category_id: 'c1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }));

  it('places Remove after the items, at the end of the drawer', async () => {
    mock.onGet('/households/hh-1/bills/b1').reply(200, editableBill);
    renderAt('/bills/confirmed/b1');
    const remove = await screen.findByRole('button', { name: /remove/i });
    const itemsHeading = screen.getByRole('heading', { name: /items/i });
    expect(
      itemsHeading.compareDocumentPosition(remove) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('toggles Edit into Cancel and makes fields editable', async () => {
    mock.onGet('/households/hh-1/bills/b1').reply(200, editableBill);
    renderAt('/bills/confirmed/b1');
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Market')).toHaveValue('Lidl');
  });

  it('Cancel discards edits and restores the previous values', async () => {
    mock.onGet('/households/hh-1/bills/b1').reply(200, editableBill);
    mock.onGet('/households/hh-1/sub-categories').reply(200, subCategories);
    renderAt('/bills/confirmed/b1');
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const category = screen.getByLabelText('Item 1 category');
    await waitFor(() => expect(category).toBeEnabled());
    await userEvent.selectOptions(category, 's2');
    const market = screen.getByLabelText('Market');
    await userEvent.clear(market);
    await userEvent.type(market, 'Kaufland');
    const total = screen.getByLabelText('Total');
    await userEvent.clear(total);
    await userEvent.type(total, '99');

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByLabelText('Market')).toBeNull();
    expect(screen.getByText('Lidl')).toBeInTheDocument();
    expect(screen.queryByText('Kaufland')).toBeNull();
    expect(screen.getByText(/milk/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByLabelText('Market')).toHaveValue('Lidl');
    expect(screen.getByLabelText('Total')).toHaveValue(10);
    expect(screen.getByLabelText('Item 1 category')).toHaveValue('s1');
  });
});
