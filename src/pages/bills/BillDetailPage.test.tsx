import '@/i18n';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  async function editTotal(value: string): Promise<void> {
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const total = screen.getByLabelText('Total');
    await userEvent.clear(total);
    await userEvent.type(total, value);
  }

  it('sends only the changed fields and shows the saved bill', async () => {
    mock.onGet(DETAIL).reply(200, confirmed);
    mock.onPut(DETAIL).reply(200, { ...confirmed, total_amount: 9 });
    renderAt('/bills/confirmed/d1');
    await editTotal('9');
    await userEvent.click(saveButton());
    await waitFor(() => expect(screen.queryByLabelText('Total')).toBeNull());
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
    const amount = screen.getByLabelText('Item 1 amount');
    await userEvent.clear(amount);
    await userEvent.type(amount, '3');
    await userEvent.click(saveButton());
    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(putBody()).toEqual({
      items: [
        { id: 'l1', sub_category_id: 's1', product_count: 1, amount: 3 },
        { id: 'l2', product_count: 1, amount: 4.71, product_weight: 0.942 },
      ],
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
    await editTotal('9');
    await userEvent.click(saveButton());
    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(confirmButton()).toBeDisabled();
  });

  it('saves a draft without confirming it', async () => {
    mock.onGet(DETAIL).reply(200, draftBill);
    mock.onPut(DETAIL).reply(200, { ...draftBill, total_amount: 9 });
    renderAt('/bills/drafts/d1');
    await editTotal('9');
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
    expect(screen.getByLabelText('Total')).toHaveValue(8);
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
