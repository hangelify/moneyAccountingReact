import '@/i18n';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Link,
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
const priceInput = (index: number): HTMLElement =>
  screen.getAllByTestId(`item-final-price-${index}`)[0]!;

// Deletes an item through its row's button and the confirm dialog.
async function deleteItem(index: number): Promise<void> {
  await userEvent.click(
    screen.getAllByRole('button', { name: /delete item/i })[index]!
  );
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: /^confirm$/i,
    })
  );
}

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
    mock.onGet(DETAIL).reply(200, { ...draftBill, status: 'confirmed' });
    renderAt('/bills/confirmed/d1');
    expect(
      await screen.findByRole('heading', { name: 'Bill details' })
    ).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('MILK')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a draft straight in the form', async () => {
    mock.onGet(DETAIL).reply(200, draftBill);
    renderAt('/bills/drafts/d1');
    expect(await screen.findByLabelText('Market name')).toHaveValue('Lidl');
    expect(screen.getAllByDisplayValue('MILK').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^reset$/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
  });

  it('Reset brings a draft back to the loaded values', async () => {
    mock.onGet(DETAIL).reply(200, draftBill);
    renderAt('/bills/drafts/d1');
    const market = await screen.findByLabelText('Market name');
    await userEvent.clear(market);
    await userEvent.type(market, 'Kaufland');
    await userEvent.click(screen.getByRole('button', { name: /^reset$/i }));
    expect(screen.getByLabelText('Market name')).toHaveValue('Lidl');
  });

  it('confirms a draft without a removed item', async () => {
    mock.onGet(DETAIL).reply(200, draftBill);
    mock.onPost(CONFIRM).reply(200, { ...draftBill, status: 'confirmed' });
    renderAt('/bills/drafts/d1');
    await screen.findByLabelText('Market name');
    await deleteItem(0);
    await userEvent.click(confirmButton());
    await waitFor(() =>
      expect(mock.history.post.some((r) => r.url === CONFIRM)).toBe(true)
    );
    expect((postedBody() as { items: unknown }).items).toEqual([
      {
        id: 'l2',
        raw_name: 'APPLES',
        product_count: 1,
        amount: 4.71,
        product_weight: 0.942,
      },
    ]);
  });

  it('disables Confirm and Save when every item was removed', async () => {
    mock.onGet(DETAIL).reply(200, draftBill);
    renderAt('/bills/drafts/d1');
    await screen.findByLabelText('Market name');
    await deleteItem(0);
    await deleteItem(0);
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('warns on a saved bill whose items do not match its total', async () => {
    mock
      .onGet(DETAIL)
      .reply(200, { ...draftBill, status: 'confirmed', total_amount: 9 });
    renderAt('/bills/confirmed/d1');
    expect(
      await screen.findByText("Items don't match the bill total")
    ).toBeInTheDocument();
  });

  it('shows no warning when a saved bill adds up', async () => {
    mock.onGet(DETAIL).reply(200, { ...draftBill, status: 'confirmed' });
    renderAt('/bills/confirmed/d1');
    await screen.findByRole('table');
    expect(screen.queryByText("Items don't match the bill total")).toBeNull();
  });

  it('switches between the items table and the chart', async () => {
    mock.onGet(DETAIL).reply(200, { ...draftBill, status: 'confirmed' });
    renderAt('/bills/confirmed/d1');
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
    mock.onGet(DETAIL).reply(200, { ...draftBill, status: 'confirmed' });
    renderAt('/bills/confirmed/d1');
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const amount = priceInput(0);
    await userEvent.clear(amount);
    await userEvent.type(amount, '9');
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryAllByTestId('item-final-price-0')).toHaveLength(0);
    expect(screen.getByText('2.49 EUR')).toBeInTheDocument();
  });

  it('confirms the edited values', async () => {
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
    const amount = priceInput(0);
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

describe('BillDetailPage duplicates', () => {
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
    total_amount: 7.2,
    currency: 'EUR',
    market_name: 'Lidl',
    created_by_name: 'Ana',
  };
  const CAND = { ...ORIGINAL, match: 'strong' };
  const confirmedBill = {
    ...draftBill,
    id: 'c1',
    status: 'confirmed',
    possible_duplicates: [CAND],
    duplicate_of: null,
  };
  const C1 = '/households/hh-1/bills/c1';

  function Probe(): ReactElement {
    return (
      <>
        <Link to="/bills/drafts/d2">go d2</Link>
        <Outlet />
      </>
    );
  }

  function renderWithNav(path: string): void {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <HouseholdTestProvider value={makeHouseholdValue()}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/bills/confirmed" element={<Probe />}>
                <Route path=":id" element={<BillDetailPage />} />
              </Route>
              <Route path="/bills/drafts" element={<Probe />}>
                <Route path=":id" element={<BillDetailPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
          <Toaster />
        </HouseholdTestProvider>
      </QueryClientProvider>
    );
  }

  it('confirmed bill with candidates: Mark calls mark-duplicate and shows the badge', async () => {
    const marked = {
      ...confirmedBill,
      status: 'duplicate',
      possible_duplicates: [],
      duplicate_of: ORIGINAL,
    };
    mock.onGet(C1).replyOnce(200, confirmedBill).onGet(C1).reply(200, marked);
    let body: unknown;
    mock.onPost(`${C1}/mark-duplicate`).reply((config) => {
      body = JSON.parse(config.data as string);
      return [200, marked];
    });
    renderWithNav('/bills/confirmed/c1');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark as duplicate' })
    );
    expect(
      await screen.findByRole('link', {
        name: "Duplicate of Ana's bill on Oct 3",
      })
    ).toBeInTheDocument();
    expect(body).toEqual({ duplicate_of_id: 'b0' });
  });

  it('Keep both calls dismiss-duplicate and refetches the bill', async () => {
    mock
      .onGet(C1)
      .replyOnce(200, confirmedBill)
      .onGet(C1)
      .reply(200, { ...confirmedBill, possible_duplicates: [] });
    mock.onPost(`${C1}/dismiss-duplicate`).reply(204);
    renderWithNav('/bills/confirmed/c1');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Keep both' })
    );
    await waitFor(() =>
      expect(screen.queryByText(/Ana already added this/)).toBeNull()
    );
    expect(mock.history.get.filter((r) => r.url === C1)).toHaveLength(2);
    expect(JSON.parse(String(mock.history.post[0]?.data))).toEqual({
      other_bill_id: 'b0',
    });
  });

  it('duplicate bill shows the badge; Unmark calls unmark-duplicate', async () => {
    const unmarked = { ...confirmedBill, possible_duplicates: [] };
    mock
      .onGet(C1)
      .replyOnce(200, {
        ...confirmedBill,
        status: 'duplicate',
        possible_duplicates: [],
        duplicate_of: ORIGINAL,
      })
      .onGet(C1)
      .reply(200, unmarked);
    mock.onPost(`${C1}/unmark-duplicate`).reply(200, unmarked);
    renderWithNav('/bills/confirmed/c1');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Unmark' })
    );
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /Duplicate of/ })).toBeNull()
    );
  });

  it('draft with candidates: Mark is pending and sent with Confirm', async () => {
    mock
      .onGet(DETAIL)
      .reply(200, { ...draftBill, possible_duplicates: [CAND] });
    mock.onPost(CONFIRM).reply(200, { ...draftBill, status: 'duplicate' });
    renderWithNav('/bills/drafts/d1');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark as duplicate' })
    );
    expect(
      screen.getByText("Will be saved as a duplicate of Ana's bill on Oct 3")
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    await waitFor(() =>
      expect(mock.history.post.some((r) => r.url === CONFIRM)).toBe(true)
    );
    expect(
      mock.history.post.some((r) => r.url?.includes('mark-duplicate'))
    ).toBe(false);
    const post = mock.history.post.find((r) => r.url === CONFIRM);
    expect(JSON.parse(String(post?.data))).toMatchObject({
      duplicate_of_id: 'b0',
    });
  });

  it('404 on confirm with a pending link stays open and drops the link', async () => {
    mock
      .onGet(DETAIL)
      .reply(200, { ...draftBill, possible_duplicates: [CAND] });
    mock.onPost(CONFIRM).reply(404, {});
    renderWithNav('/bills/drafts/d1');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark as duplicate' })
    );
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(
      await screen.findByText(
        "Couldn't link: the original bill no longer exists."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Bill details' })
    ).toBeInTheDocument();
    // The bill is refetched so a deleted original drops out of the banner.
    await waitFor(() =>
      expect(mock.history.get.filter((r) => r.url === DETAIL)).toHaveLength(2)
    );
  });

  it('the pending link does not carry over to another draft', async () => {
    mock
      .onGet(DETAIL)
      .reply(200, { ...draftBill, possible_duplicates: [CAND] });
    mock
      .onGet('/households/hh-1/bills/d2')
      .reply(200, { ...draftBill, id: 'd2', possible_duplicates: [] });
    mock
      .onPost('/households/hh-1/bills/d2/confirm')
      .reply(200, { ...draftBill, id: 'd2', status: 'confirmed' });
    renderWithNav('/bills/drafts/d1');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark as duplicate' })
    );
    await userEvent.click(screen.getByRole('link', { name: 'go d2' }));
    await waitFor(() => expect(screen.queryByText(/Will be saved/)).toBeNull());
    await userEvent.click(
      await screen.findByRole('button', { name: /^confirm$/i })
    );
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(String(mock.history.post[0]?.data))).not.toHaveProperty(
      'duplicate_of_id'
    );
  });

  it('edits of one draft do not show on another', async () => {
    mock.onGet(DETAIL).reply(200, draftBill);
    mock.onGet('/households/hh-1/bills/d2').reply(200, {
      ...draftBill,
      id: 'd2',
      market: { id: 'm2', name: 'Aldi', city: null },
    });
    renderWithNav('/bills/drafts/d1');
    const market = await screen.findByLabelText('Market name');
    await userEvent.clear(market);
    await userEvent.type(market, 'Kaufland');
    await userEvent.click(screen.getByRole('link', { name: 'go d2' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Market name')).toHaveValue('Aldi')
    );
  });

  it('receipt fields show when set', async () => {
    mock.onGet(C1).reply(200, {
      ...confirmedBill,
      possible_duplicates: [],
      fiscal_register_id: 'J403001234',
      fiscal_receipt_number: '0042',
      purchase_time: '14:05',
    });
    renderWithNav('/bills/confirmed/c1');
    expect(await screen.findByText('J403001234')).toBeInTheDocument();
    expect(screen.getByText('0042')).toBeInTheDocument();
    expect(screen.getByText('14:05')).toBeInTheDocument();
  });
});

describe('BillDetailPage save', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  const confirmed = { ...draftBill, status: 'confirmed' };
  const saveButton = (): HTMLElement =>
    screen.getByRole('button', { name: /^save$/i });
  const putBody = (): unknown =>
    JSON.parse(String(mock.history.put?.[0]?.data));

  // A confirmed bill needs Edit first; a draft is already in the form.
  async function editTotal(value: string, clickEdit = true): Promise<void> {
    if (clickEdit) {
      await userEvent.click(
        await screen.findByRole('button', { name: /edit/i })
      );
    }
    const total = await screen.findByLabelText('Total amount');
    await userEvent.clear(total);
    await userEvent.type(total, value);
  }

  it('sends only the changed fields and shows the saved bill', async () => {
    mock.onGet(DETAIL).reply(200, confirmed);
    mock.onPut(DETAIL).reply(200, { ...confirmed, total_amount: 9 });
    renderAt('/bills/confirmed/d1');
    await editTotal('9');
    await userEvent.click(saveButton());
    await waitFor(() =>
      expect(screen.queryByLabelText('Total amount')).toBeNull()
    );
    expect(putBody()).toEqual({ total_amount: 9 });
    expect(screen.getAllByText('9.00 EUR').length).toBeGreaterThan(0);
    expect(await screen.findByText('Bill saved')).toBeInTheDocument();
    expect(mock.history.post).toHaveLength(0);
  });

  it('sends the full list of lines when a line changed', async () => {
    mock.onGet(DETAIL).reply(200, confirmed);
    mock.onPut(DETAIL).reply(200, confirmed);
    renderAt('/bills/confirmed/d1');
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const amount = priceInput(0);
    await userEvent.clear(amount);
    await userEvent.type(amount, '3');
    await userEvent.click(saveButton());
    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(putBody()).toEqual({
      items: [
        {
          id: 'l1',
          sub_category_id: 's1',
          raw_name: 'MILK',
          product_count: 1,
          amount: 3,
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
  });

  it('saves an added item as a new line', async () => {
    mock.onGet(DETAIL).reply(200, confirmed);
    mock.onPut(DETAIL).reply(200, confirmed);
    renderAt('/bills/confirmed/d1');
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));
    // A new line needs a name or a category before it can be saved.
    await userEvent.type(
      document.querySelectorAll<HTMLInputElement>('[data-row-name="2"]')[0]!,
      'BREAD'
    );
    const price = priceInput(2);
    await userEvent.clear(price);
    await userEvent.type(price, '1.5');
    await userEvent.click(saveButton());
    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    const items = (putBody() as { items: object[] }).items;
    expect(items).toHaveLength(3);
    expect(items[2]).toEqual({
      raw_name: 'BREAD',
      product_count: 1,
      amount: 1.5,
    });
  });

  it('disables Save until something changed', async () => {
    mock.onGet(DETAIL).reply(200, confirmed);
    renderAt('/bills/confirmed/d1');
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    expect(saveButton()).toBeDisabled();
  });

  it('hides Save outside edit mode', async () => {
    mock.onGet(DETAIL).reply(200, confirmed);
    renderAt('/bills/confirmed/d1');
    await screen.findByRole('button', { name: /edit/i });
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull();
  });

  it('disables Save and Confirm while the request runs', async () => {
    mock.onGet(DETAIL).reply(200, draftBill);
    mock.onPut(DETAIL).reply(() => new Promise(() => undefined));
    renderAt('/bills/drafts/d1');
    await editTotal('9', false);
    await userEvent.click(saveButton());
    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(confirmButton()).toBeDisabled();
  });

  it('saves a draft without confirming it', async () => {
    mock.onGet(DETAIL).reply(200, draftBill);
    mock.onPut(DETAIL).reply(200, { ...draftBill, total_amount: 9 });
    renderAt('/bills/drafts/d1');
    await editTotal('9', false);
    await userEvent.click(saveButton());
    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(mock.history.post).toHaveLength(0);
    expect(confirmButton()).toBeInTheDocument();
  });

  it('keeps the edits and shows the server message on 400', async () => {
    mock.onGet(DETAIL).reply(200, confirmed);
    mock.onPut(DETAIL).reply(400, {
      statusCode: 400,
      message: ['SubCategory with ID s1 not found'],
      error: 'Bad Request',
    });
    renderAt('/bills/confirmed/d1');
    await editTotal('8');
    await userEvent.click(saveButton());
    expect(
      await screen.findByText('SubCategory with ID s1 not found')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Total amount')).toHaveValue('8');
  });

  it('goes back to the list when the bill is gone (404)', async () => {
    mock.onGet(DETAIL).reply(200, confirmed);
    mock.onPut(DETAIL).reply(404, {});
    renderAt('/bills/confirmed/d1');
    await editTotal('8');
    await userEvent.click(saveButton());
    expect(
      await screen.findByText('This bill no longer exists.')
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent(
        /^\/bills\/confirmed$/
      )
    );
  });
});

describe('BillDetailPage delete', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  const confirmed = { ...draftBill, status: 'confirmed' };
  const dialog = (): HTMLElement => screen.getByRole('dialog');

  async function openDialog(label: RegExp): Promise<void> {
    await userEvent.click(await screen.findByRole('button', { name: label }));
    await screen.findByRole('dialog');
  }

  it('asks before deleting a confirmed bill and warns it is final', async () => {
    mock.onGet(DETAIL).reply(200, confirmed);
    renderAt('/bills/confirmed/d1');
    await openDialog(/^delete bill$/i);
    expect(dialog()).toHaveTextContent('Delete this bill?');
    expect(dialog()).toHaveTextContent(/won't have access to it/i);
    expect(dialog()).toHaveTextContent(/can't be undone/i);
    expect(mock.history.delete).toHaveLength(0);
  });

  it('words the action for a draft', async () => {
    mock.onGet(DETAIL).reply(200, draftBill);
    renderAt('/bills/drafts/d1');
    await openDialog(/^discard draft$/i);
    expect(dialog()).toHaveTextContent('Discard this draft?');
  });

  it('words the action for a duplicate', async () => {
    mock.onGet(DETAIL).reply(200, {
      ...confirmed,
      status: 'duplicate',
      duplicate_of: {
        id: 'b0',
        bill_date: '2026-10-03',
        total_amount: 7.2,
        currency: 'EUR',
        market_name: 'Lidl',
        created_by_name: 'Ana',
      },
    });
    renderAt('/bills/confirmed/d1');
    await openDialog(/^delete copy$/i);
    expect(dialog()).toHaveTextContent('Delete this copy?');
  });

  it('Cancel closes the dialog without deleting', async () => {
    mock.onGet(DETAIL).reply(200, confirmed);
    renderAt('/bills/confirmed/d1');
    await openDialog(/^delete bill$/i);
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mock.history.delete).toHaveLength(0);
    expect(screen.getByTestId('loc')).toHaveTextContent('/bills/confirmed/d1');
  });

  it('deletes the bill and goes back to the list', async () => {
    mock.onGet(DETAIL).reply(200, confirmed);
    mock.onDelete(DETAIL).reply(204);
    renderAt('/bills/confirmed/d1?page=2');
    await openDialog(/^delete bill$/i);
    await userEvent.click(
      within(dialog()).getByRole('button', { name: /^delete bill$/i })
    );
    expect(await screen.findByText('Bill deleted')).toBeInTheDocument();
    expect(mock.history.delete).toHaveLength(1);
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent(
        /^\/bills\/confirmed$/
      )
    );
    expect(screen.getByTestId('search')).toHaveTextContent('?page=2');
  });

  it('treats 404 as already deleted', async () => {
    mock.onGet(DETAIL).reply(200, confirmed);
    mock.onDelete(DETAIL).reply(404, {});
    renderAt('/bills/confirmed/d1');
    await openDialog(/^delete bill$/i);
    await userEvent.click(
      within(dialog()).getByRole('button', { name: /^delete bill$/i })
    );
    expect(
      await screen.findByText('This bill was already deleted.')
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent(
        /^\/bills\/confirmed$/
      )
    );
  });

  it('keeps the bill and allows a retry on 500', async () => {
    mock.onGet(DETAIL).reply(200, confirmed);
    mock.onDelete(DETAIL).reply(500, {});
    renderAt('/bills/confirmed/d1');
    await openDialog(/^delete bill$/i);
    await userEvent.click(
      within(dialog()).getByRole('button', { name: /^delete bill$/i })
    );
    expect(
      await screen.findByText("Couldn't delete the bill. Try again.")
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('loc')).toHaveTextContent('/bills/confirmed/d1');
    expect(
      screen.getByRole('button', { name: /^delete bill$/i })
    ).toBeEnabled();
  });

  it('disables Edit and Delete while the delete runs', async () => {
    mock.onGet(DETAIL).reply(200, confirmed);
    mock.onDelete(DETAIL).reply(() => new Promise(() => undefined));
    renderAt('/bills/confirmed/d1');
    await openDialog(/^delete bill$/i);
    await userEvent.click(
      within(dialog()).getByRole('button', { name: /^delete bill$/i })
    );
    await waitFor(() =>
      expect(
        within(dialog()).getByRole('button', { name: /^delete bill$/i })
      ).toBeDisabled()
    );
    expect(
      screen.getByRole('button', { name: /^edit$/i, hidden: true })
    ).toBeDisabled();
  });

  describe('a failed bill', () => {
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
    const IMAGE = '/households/hh-1/bills/drafts/d1/image';

    beforeEach(() => {
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: () => 'blob:failed-photo',
        revokeObjectURL: () => undefined,
      });
      mock.onGet(IMAGE).reply(200, new Blob(['x'], { type: 'image/jpeg' }));
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    async function addBread(): Promise<void> {
      await userEvent.click(screen.getByRole('button', { name: /add item/i }));
      const name = document.querySelector<HTMLElement>('[data-row-name="0"]');
      if (!name) throw new Error('no name input for row 0');
      await userEvent.type(name, 'Bread');
      const price = priceInput(0);
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
      const img = await screen.findByAltText('Receipt photo');
      expect(img).toHaveAttribute('src', 'blob:failed-photo');
      expect(screen.getByRole('button', { name: /^reset$/i })).toBeDisabled();
    });

    it('falls back to the generic banner without an error message', async () => {
      mock
        .onGet(DETAIL)
        .reply(200, { ...failedBill, parse_error_message: null });
      renderAt('/bills/drafts/d1');
      expect(
        await screen.findByText(
          "This receipt couldn't be read. Enter it manually."
        )
      ).toHaveAttribute('role', 'status');
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
      const post = mock.history.post[0];
      const body = JSON.parse(String(post?.data)) as { items: object[] };
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
      expect(screen.queryByText(/look-alike|duplicate/i)).toBeNull();
      expect(screen.queryByRole('button', { name: /mark/i })).toBeNull();
    });
  });
});
