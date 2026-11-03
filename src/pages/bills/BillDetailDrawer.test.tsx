// src/pages/bills/BillDetailDrawer.test.tsx
import '@/i18n';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
import { Toaster } from '@/components/ui/toaster';
import { mockMatchMedia } from '@/test/matchMedia';

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
        <Toaster />
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

  it('shows Confirm and Discard draft actions for a draft bill', async () => {
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
    expect(
      screen.getByRole('button', { name: /^discard draft$/i })
    ).toBeInTheDocument();
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
        screen.getByRole('button', { name: /^delete bill$/i })
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
        id: 'l1',
        raw_name: 'MILK',
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

  it('places Delete after the items, at the end of the drawer', async () => {
    mock.onGet('/households/hh-1/bills/b1').reply(200, editableBill);
    renderAt('/bills/confirmed/b1');
    const remove = await screen.findByRole('button', {
      name: /^delete bill$/i,
    });
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
    expect(screen.getByLabelText('Market name')).toHaveValue('Lidl');
  });

  it('Cancel discards edits and restores the previous values', async () => {
    mock.onGet('/households/hh-1/bills/b1').reply(200, editableBill);
    mock.onGet('/households/hh-1/sub-categories').reply(200, subCategories);
    renderAt('/bills/confirmed/b1');
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const category = screen.getAllByLabelText('Category')[0]!;
    await waitFor(() => expect(category).toBeEnabled());
    await userEvent.selectOptions(category, 's2');
    const market = screen.getByLabelText('Market name');
    await userEvent.clear(market);
    await userEvent.type(market, 'Kaufland');
    const total = screen.getByLabelText('Total amount');
    await userEvent.clear(total);
    await userEvent.type(total, '99');

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByLabelText('Market name')).toBeNull();
    expect(screen.getByText('Lidl')).toBeInTheDocument();
    expect(screen.queryByText('Kaufland')).toBeNull();
    expect(screen.getByText(/milk/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByLabelText('Market name')).toHaveValue('Lidl');
    expect(screen.getByLabelText('Total amount')).toHaveValue(10);
    expect(screen.getAllByLabelText('Category')[0]).toHaveValue('s1');
  });

  it('removes an item and saves the shorter list', async () => {
    const twoLines = {
      ...editableBill,
      status: 'confirmed',
      items: [
        ...editableBill.items,
        { ...editableBill.items[0]!, id: 'l2', raw_name: 'BREAD', amount: 2 },
      ],
    };
    mock.onGet('/households/hh-1/bills/b1').reply(200, twoLines);
    mock.onPut('/households/hh-1/bills/b1').reply(200, editableBill);
    renderAt('/bills/confirmed/b1');
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    await userEvent.click(
      screen.getAllByRole('button', { name: /delete item/i })[1]!
    );
    await userEvent.click(
      within(
        screen.getByRole('dialog', { name: /delete this item/i })
      ).getByRole('button', { name: /^confirm$/i })
    );
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(JSON.parse(String(mock.history.put[0]?.data))).toEqual({
      items: [
        {
          id: 'l1',
          sub_category_id: 's1',
          raw_name: 'MILK',
          product_count: 1,
          amount: 10,
        },
      ],
    });
  });

  it('warns when the saved items do not match the total', async () => {
    mock
      .onGet('/households/hh-1/bills/b1')
      .reply(200, { ...editableBill, total_amount: 12 });
    renderAt('/bills/confirmed/b1');
    expect(
      await screen.findByText("Items don't match the bill total")
    ).toBeInTheDocument();
  });

  describe('Confirm', () => {
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

    function postedBody(): unknown {
      const post = mock.history.post?.find((r) => r.url === CONFIRM);
      return JSON.parse(String(post?.data));
    }

    it('confirms the loaded data as opened', async () => {
      mock.onGet(DETAIL).reply(200, draftBill);
      mock.onPost(CONFIRM).reply(200, { ...draftBill, status: 'confirmed' });
      renderAt('/bills/drafts/d1');
      await userEvent.click(
        await screen.findByRole('button', { name: /confirm/i })
      );
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: /confirm/i })).toBeNull()
      );
      expect(postedBody()).toEqual({
        market_id: 'm1',
        bill_date: '2026-10-28',
        currency: 'EUR',
        total_amount: 7.2,
        items: [
          {
            id: 'l1',
            sub_category_id: 's1',
            raw_name: 'MILK',
            product_count: 1,
            amount: 2.49,
          },
          {
            id: 'l2',
            raw_name: 'APPLES',
            product_count: 1,
            amount: 4.71,
            product_weight: 0.942,
          },
        ],
      });
      expect(await screen.findByText('Bill confirmed')).toBeInTheDocument();
    });

    it('refreshes the dashboard after confirm', async () => {
      const spy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
      mock.onGet(DETAIL).reply(200, draftBill);
      mock.onPost(CONFIRM).reply(200, { ...draftBill, status: 'confirmed' });
      renderAt('/bills/drafts/d1');
      await userEvent.click(
        await screen.findByRole('button', { name: /confirm/i })
      );
      await waitFor(() =>
        expect(spy).toHaveBeenCalledWith({
          queryKey: ['households', 'hh-1', 'dashboard'],
        })
      );
      spy.mockRestore();
    });

    it('confirms the edited values and leaves edit mode', async () => {
      mock.onGet(DETAIL).reply(200, draftBill);
      mock
        .onPost(CONFIRM)
        .reply(200, { ...draftBill, status: 'confirmed', total_amount: 9 });
      renderAt('/bills/drafts/d1');
      const market = await screen.findByLabelText('Market name');
      await userEvent.clear(market);
      await userEvent.type(market, 'Kaufland');
      const total = screen.getByLabelText('Total amount');
      await userEvent.clear(total);
      await userEvent.type(total, '9');
      const amount = screen.getAllByTestId('item-final-price-0')[0]!;
      await userEvent.clear(amount);
      await userEvent.type(amount, '4.29');

      await userEvent.click(confirmButton());
      await waitFor(() =>
        expect(screen.queryByLabelText('Market name')).toBeNull()
      );
      expect(postedBody()).toMatchObject({
        new_market: { name: 'Kaufland' },
        total_amount: 9,
        items: [{ id: 'l1', amount: 4.29 }, { id: 'l2' }],
      });
      expect(postedBody()).not.toHaveProperty('market_id');
    });

    it('disables Confirm while the edited form is invalid', async () => {
      mock.onGet(DETAIL).reply(200, draftBill);
      renderAt('/bills/drafts/d1');
      await userEvent.clear(await screen.findByLabelText('Total amount'));
      expect(confirmButton()).toBeDisabled();
    });

    it('disables Confirm while the request runs', async () => {
      mock.onGet(DETAIL).reply(200, draftBill);
      mock.onPost(CONFIRM).reply(() => new Promise(() => undefined));
      renderAt('/bills/drafts/d1');
      await userEvent.click(
        await screen.findByRole('button', { name: /confirm/i })
      );
      await waitFor(() => expect(confirmButton()).toBeDisabled());
    });

    it('shows the saved bill on 409 instead of an error', async () => {
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

    it('keeps the edits and shows the server message on 400', async () => {
      mock.onGet(DETAIL).reply(200, draftBill);
      mock.onPost(CONFIRM).reply(400, {
        statusCode: 400,
        message: ['SubCategory with ID s1 not found'],
        error: 'Bad Request',
      });
      renderAt('/bills/drafts/d1');
      const total = await screen.findByLabelText('Total amount');
      await userEvent.clear(total);
      await userEvent.type(total, '8');
      await userEvent.click(confirmButton());
      expect(
        await screen.findByText('SubCategory with ID s1 not found')
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Total amount')).toHaveValue(8);
    });

    it('closes the drawer when the draft is gone (404)', async () => {
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
  });
});

describe('BillDetailDrawer save', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  const bill = {
    id: 'c1',
    bill_date: '2026-10-28',
    total_amount: 10,
    amount_mismatch: false,
    currency: 'EUR',
    created_at: '2026-10-28T10:00:00Z',
    status: 'confirmed',
    market: { id: 'm1', name: 'Lidl', city: null },
    items: [
      {
        id: 'l1',
        raw_name: 'MILK',
        sub_category: null,
        product_count: 1,
        amount: 10,
        product_weight: null,
      },
    ],
  };
  const C1 = '/households/hh-1/bills/c1';

  it('Save PUTs the changed fields and leaves edit mode', async () => {
    mock.onGet(C1).reply(200, bill);
    mock.onPut(C1).reply(200, { ...bill, bill_date: '2026-10-27' });
    renderAt('/bills/confirmed/c1');
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const date = screen.getByLabelText('Date');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-10-27');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(screen.queryByLabelText('Date')).toBeNull());
    expect(JSON.parse(String(mock.history.put?.[0]?.data))).toEqual({
      bill_date: '2026-10-27',
    });
  });
});

describe('BillDetailDrawer duplicates', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  const ORIGINAL = {
    id: 'b0',
    bill_date: '2026-10-03',
    total_amount: 10,
    currency: 'EUR',
    market_name: 'Lidl',
    created_by_name: 'Ana',
  };
  const bill = {
    id: 'c1',
    bill_date: '2026-10-28',
    total_amount: 10,
    amount_mismatch: false,
    currency: 'EUR',
    created_at: '2026-10-28T10:00:00Z',
    status: 'confirmed',
    market: { id: 'm1', name: 'Lidl', city: null },
    items: [],
    possible_duplicates: [{ ...ORIGINAL, match: 'strong' }],
    duplicate_of: null,
  };
  const C1 = '/households/hh-1/bills/c1';

  it('Mark on a confirmed bill calls mark-duplicate and shows the badge', async () => {
    const marked = {
      ...bill,
      status: 'duplicate',
      possible_duplicates: [],
      duplicate_of: ORIGINAL,
    };
    mock.onGet(C1).replyOnce(200, bill).onGet(C1).reply(200, marked);
    mock.onPost(`${C1}/mark-duplicate`).reply(200, marked);
    renderAt('/bills/confirmed/c1');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark as duplicate' })
    );
    expect(
      await screen.findByRole('link', {
        name: "Duplicate of Ana's bill on Oct 3",
      })
    ).toBeInTheDocument();
  });

  it('Unmark on a duplicate calls unmark-duplicate', async () => {
    const unmarked = { ...bill, possible_duplicates: [] };
    mock
      .onGet(C1)
      .replyOnce(200, {
        ...bill,
        status: 'duplicate',
        possible_duplicates: [],
        duplicate_of: ORIGINAL,
      })
      .onGet(C1)
      .reply(200, unmarked);
    mock.onPost(`${C1}/unmark-duplicate`).reply(200, unmarked);
    renderAt('/bills/confirmed/c1');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Unmark' })
    );
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /Duplicate of/ })).toBeNull()
    );
  });
});

describe('BillDetailDrawer delete', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  const DETAIL = '/households/hh-1/bills/b1';
  const bill = {
    id: 'b1',
    bill_date: '2026-05-19T00:00:00Z',
    total_amount: 10,
    amount_mismatch: false,
    currency: 'EUR',
    created_at: '2026-05-19T10:00:00Z',
    status: 'confirmed',
    market: null,
    items: [],
  };

  async function confirmDelete(): Promise<void> {
    await userEvent.click(
      await screen.findByRole('button', { name: /^delete bill$/i })
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Delete this bill?',
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: /^delete bill$/i })
    );
  }

  it('deletes after confirmation and closes the drawer', async () => {
    mock.onGet(DETAIL).reply(200, bill);
    mock.onDelete(DETAIL).reply(204);
    renderAt('/bills/confirmed/b1');
    await confirmDelete();
    expect(await screen.findByText('Bill deleted')).toBeInTheDocument();
    expect(mock.history.delete).toHaveLength(1);
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent(
        /^\/bills\/confirmed$/
      )
    );
  });

  it('refreshes the bills lists and the dashboard after delete', async () => {
    const spy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    mock.onGet(DETAIL).reply(200, bill);
    mock.onDelete(DETAIL).reply(204);
    renderAt('/bills/confirmed/b1');
    await confirmDelete();
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({
        queryKey: ['households', 'hh-1', 'dashboard'],
      })
    );
    expect(spy).toHaveBeenCalledWith({
      queryKey: ['households', 'hh-1', 'bills'],
    });
    spy.mockRestore();
  });
});

describe('BillDetailDrawer failed bill', () => {
  let mock: MockAdapter;
  const DETAIL = '/households/hh-1/bills/d1';
  const CONFIRM = '/households/hh-1/bills/d1/confirm';
  const failedBill = {
    id: 'd1',
    bill_date: '2026-10-28',
    total_amount: 0,
    amount_mismatch: false,
    currency: 'EUR',
    created_at: '2026-10-28T10:00:00Z',
    status: 'failed',
    parse_error_code: 'not_a_receipt',
    parse_error_message: 'No receipt found in the photo',
    market: null,
    items: [],
    possible_duplicates: [
      {
        id: 'x1',
        bill_date: '2026-10-28',
        total_amount: 7.5,
        market_name: null,
      },
    ],
  };
  const confirmButton = (): HTMLElement =>
    screen.getByRole('button', { name: /^confirm$/i });

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:failed-photo',
      revokeObjectURL: () => undefined,
    });
    mock
      .onGet('/households/hh-1/bills/drafts/d1/image')
      .reply(200, new Blob(['x'], { type: 'image/jpeg' }));
  });
  afterEach(() => {
    mock.restore();
    vi.unstubAllGlobals();
  });

  async function addBread(): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));
    const name = document.querySelector<HTMLElement>('[data-row-name="0"]');
    if (!name) throw new Error('no name input for row 0');
    await userEvent.type(name, 'Bread');
    const price = screen.getAllByTestId('item-final-price-0')[0];
    if (!price) throw new Error('no price input for row 0');
    await userEvent.clear(price);
    await userEvent.type(price, '7.5');
    // The total of a failed bill starts at 0 and is not derived from lines.
    const total = screen.getByLabelText('Total amount');
    await userEvent.clear(total);
    await userEvent.type(total, '7.5');
  }

  it('a failed bill opens in the form with the error banner and its photo', async () => {
    mock.onGet(DETAIL).reply(200, failedBill);
    renderAt('/bills/drafts/d1');
    expect(await screen.findByLabelText('Market name')).toBeInTheDocument();
    expect(screen.getByText('No receipt found in the photo')).toHaveAttribute(
      'role',
      'status'
    );
    expect(await screen.findByAltText('Receipt photo')).toHaveAttribute(
      'src',
      'blob:failed-photo'
    );
  });

  it('Confirm is disabled until a line with a name and price is added', async () => {
    mock.onGet(DETAIL).reply(200, failedBill);
    renderAt('/bills/drafts/d1');
    await screen.findByLabelText('Market name');
    expect(confirmButton()).toBeDisabled();
    await addBread();
    await waitFor(() => expect(confirmButton()).toBeEnabled());
  });

  it('adding a line and confirming posts raw_name, product_count and amount', async () => {
    mock.onGet(DETAIL).reply(200, failedBill);
    mock.onPost(CONFIRM).reply(200, { ...failedBill, status: 'confirmed' });
    renderAt('/bills/drafts/d1');
    await screen.findByLabelText('Market name');
    await addBread();
    await userEvent.click(confirmButton());
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    const body = JSON.parse(String(mock.history.post[0]?.data)) as {
      items: object[];
    };
    expect(body.items[0]).toMatchObject({
      raw_name: 'Bread',
      product_count: 1,
      amount: 7.5,
    });
  });

  it('no duplicate section for a failed bill', async () => {
    mock.onGet(DETAIL).reply(200, failedBill);
    renderAt('/bills/drafts/d1');
    await screen.findByLabelText('Market name');
    expect(screen.queryByText(/duplicate/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /^mark/i })).toBeNull();
  });

  it('on mobile the photo can be hidden and shown again', async () => {
    mock.onGet(DETAIL).reply(200, failedBill);
    renderAt('/bills/drafts/d1');
    await screen.findByAltText('Receipt photo');
    await userEvent.click(screen.getByRole('button', { name: 'Hide photo' }));
    expect(screen.queryByAltText('Receipt photo')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Show photo' }));
    expect(screen.getByAltText('Receipt photo')).toBeInTheDocument();
  });

  it('on desktop the photo is always shown', async () => {
    const media = mockMatchMedia(true);
    try {
      mock.onGet(DETAIL).reply(200, failedBill);
      renderAt('/bills/drafts/d1');
      await screen.findByAltText('Receipt photo');
      expect(screen.queryByRole('button', { name: /hide photo/i })).toBeNull();
    } finally {
      media.restore();
    }
  });
});
