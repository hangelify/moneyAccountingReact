import '@/i18n';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Link,
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import type { ReactElement } from 'react';
import { apiClient } from '@/auth/apiClient';
import type * as UseToastModule from '@/components/ui/use-toast';
import { toast } from '@/components/ui/use-toast';
import type { HouseholdContextValue } from '@/contexts/HouseholdContext';
import {
  HouseholdTestProvider,
  makeHouseholdValue,
  TEST_HOUSEHOLDS,
} from '@/test/household';
import { mockMatchMedia } from '@/test/matchMedia';
import type { DraftBillDto } from '@/types/bills';
import { DraftBills } from './DraftBills';
import { ConfirmedBills } from './ConfirmedBills';
import { BillDetailRoute } from './BillDetailRoute';

vi.mock('@/components/ui/use-toast', async (importOriginal) => {
  const actual = await importOriginal<typeof UseToastModule>();
  return { ...actual, toast: vi.fn() };
});

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
    // A draft opens in the form on both layouts.
    expect(await screen.findByLabelText('Market name')).toBeInTheDocument();
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

describe('BillDetailRoute: budget from the link', () => {
  let mock: MockAdapter;
  let mm: ReturnType<typeof mockMatchMedia>;
  const [personal, family] = TEST_HOUSEHOLDS as [
    (typeof TEST_HOUSEHOLDS)[number],
    (typeof TEST_HOUSEHOLDS)[number],
  ];
  const confirmed = { ...detail, id: 'b1', status: 'confirmed' };

  beforeEach(() => {
    vi.mocked(toast).mockReset();
    mm = mockMatchMedia(true);
    mock = new MockAdapter(apiClient);
    mock.onGet(/\/markets$/).reply(200, []);
    mock.onGet('/households/hh-1/bills/b1').reply(200, confirmed);
    mock.onGet('/households/hh-2/bills/b1').reply(200, confirmed);
    mock.onGet(/\/bills\/b2$/).reply(200, { ...confirmed, id: 'b2' });
  });
  afterEach(() => {
    mock.restore();
    mm.restore();
  });

  function renderLink(
    initial: string,
    value: HouseholdContextValue,
    nextLink = '/bills/b2?hid=hh-2'
  ): (next: HouseholdContextValue) => void {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const tree = (v: HouseholdContextValue): ReactElement => (
      <QueryClientProvider client={qc}>
        <HouseholdTestProvider value={v}>
          <MemoryRouter initialEntries={[initial]}>
            <LocationProbe />
            <Link to={nextLink}>next link</Link>
            <Routes>
              <Route path="/bills/:id" element={<BillDetailRoute />} />
            </Routes>
          </MemoryRouter>
        </HouseholdTestProvider>
      </QueryClientProvider>
    );
    const { rerender } = render(tree(value));
    return (next) => rerender(tree(next));
  }

  const detailRequests = (): string[] =>
    mock.history.get
      .map((r) => r.url ?? '')
      .filter((u) => u.endsWith('/bills/b1'));

  it('switches to the budget from the link and drops hid', async () => {
    const value = makeHouseholdValue();
    renderLink('/bills/b1?hid=hh-2', value);
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent(/^\/bills\/b1$/)
    );
    expect(value.setActiveHouseholdId).toHaveBeenCalledTimes(1);
    expect(value.setActiveHouseholdId).toHaveBeenCalledWith('hh-2');
    expect(toast).toHaveBeenCalledWith({
      title: 'Switched to budget Family Budget',
    });
    // Waits for the switch; nothing is fetched from the old budget.
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(detailRequests()).toEqual([]);
  });

  it('does not switch back after a manual switch', async () => {
    const setActiveHouseholdId = vi.fn();
    const value = makeHouseholdValue({ setActiveHouseholdId });
    const rerender = renderLink('/bills/b1?hid=hh-2', value);
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent(/^\/bills\/b1$/)
    );
    // The switch lands.
    rerender({ ...value, activeHousehold: family });
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(detailRequests()).toEqual(['/households/hh-2/bills/b1']);
    // A manual switch back to Personal.
    rerender({ ...value, activeHousehold: personal });
    await waitFor(() =>
      expect(detailRequests()).toContain('/households/hh-1/bills/b1')
    );
    expect(setActiveHouseholdId).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('loc').textContent).toBe('/bills/b1');
  });

  it('a second link to the same budget switches again', async () => {
    const setActiveHouseholdId = vi.fn();
    const value = makeHouseholdValue({ setActiveHouseholdId });
    const rerender = renderLink('/bills/b1?hid=hh-2', value);
    await waitFor(() =>
      expect(screen.getByTestId('loc').textContent).toBe('/bills/b1')
    );
    rerender({ ...value, activeHousehold: family });
    expect(await screen.findByRole('table')).toBeInTheDocument();
    // A manual switch back, then another link into Family Budget.
    rerender({ ...value, activeHousehold: personal });
    await userEvent.click(screen.getByRole('link', { name: 'next link' }));
    await waitFor(() =>
      expect(screen.getByTestId('loc').textContent).toBe('/bills/b2')
    );
    expect(setActiveHouseholdId).toHaveBeenCalledTimes(2);
    expect(setActiveHouseholdId).toHaveBeenLastCalledWith('hh-2');
  });

  it('a second link to the same unknown budget refetches again', async () => {
    const value = makeHouseholdValue();
    renderLink('/bills/b1?hid=hh-gone', value, '/bills/b2?hid=hh-gone');
    await screen.findByText("This bill is in a budget you can't access.");
    await userEvent.click(screen.getByRole('link', { name: 'next link' }));
    await waitFor(() => expect(value.refetch).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText("This bill is in a budget you can't access.")
    ).toBeInTheDocument();
  });

  it('a switch that does not land ends as inaccessible, not Loading', async () => {
    const value = makeHouseholdValue();
    const rerender = renderLink('/bills/b1?hid=hh-2', value);
    await waitFor(() =>
      expect(value.setActiveHouseholdId).toHaveBeenCalledWith('hh-2')
    );
    // Family Budget is gone before the switch lands.
    rerender({ ...value, households: [personal] });
    expect(
      await screen.findByText("This bill is in a budget you can't access.")
    ).toBeInTheDocument();
    expect(value.refetch).toHaveBeenCalledTimes(1);
    expect(detailRequests()).toEqual([]);
  });

  it('refetches once for an unknown budget, then shows inaccessible', async () => {
    const value = makeHouseholdValue();
    renderLink('/bills/b1?hid=hh-gone', value);
    expect(
      await screen.findByText("This bill is in a budget you can't access.")
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to list' })).toHaveAttribute(
      'href',
      '/bills'
    );
    expect(value.refetch).toHaveBeenCalledTimes(1);
    expect(value.setActiveHouseholdId).not.toHaveBeenCalled();
    expect(detailRequests()).toEqual([]);
  });

  it('unknown budget found after refetch switches', async () => {
    const shared = {
      ...family,
      id: 'hh-3',
      name: 'Shared Trip',
    };
    const setActiveHouseholdId = vi.fn();
    let resolveRefetch: () => void = () => undefined;
    const refetch = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefetch = resolve;
        })
    );
    const value = makeHouseholdValue({ setActiveHouseholdId, refetch });
    const rerender = renderLink('/bills/b1?hid=hh-3', value);
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    // The refreshed list now has the budget.
    rerender({ ...value, households: [...TEST_HOUSEHOLDS, shared] });
    await act(async () => {
      resolveRefetch();
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(setActiveHouseholdId).toHaveBeenCalledWith('hh-3')
    );
    expect(value.refetch).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith({
      title: 'Switched to budget Shared Trip',
    });
    expect(
      screen.queryByText("This bill is in a budget you can't access.")
    ).toBeNull();
  });

  it('matching hid renders the bill', async () => {
    const value = makeHouseholdValue();
    renderLink('/bills/b1?hid=hh-1', value);
    expect(await screen.findByRole('table')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('loc').textContent).toBe('/bills/b1')
    );
    expect(value.setActiveHouseholdId).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('waits while households load', () => {
    const value = makeHouseholdValue({
      status: 'loading',
      households: [],
      activeHousehold: null,
    });
    renderLink('/bills/b1?hid=hh-2', value);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(value.setActiveHouseholdId).not.toHaveBeenCalled();
    expect(value.refetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('loc').textContent).toBe('/bills/b1?hid=hh-2');
  });
});
