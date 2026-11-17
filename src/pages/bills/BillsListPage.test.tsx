// Selection mode and bulk move on the confirmed list (shared BillsListPage).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import type { ReactElement } from 'react';
import { apiClient } from '@/auth/apiClient';
import { toast } from '@/components/ui/use-toast';
import type { BillResponseDto } from '@/types/bills';
import type { Household } from '@/types/households';
import '@/i18n';
import {
  HouseholdTestProvider,
  TEST_HID,
  TEST_HOUSEHOLDS,
  makeHouseholdValue,
} from '@/test/household';
import { ConfirmedBills } from './ConfirmedBills';

vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));

function renderList(opts: { households?: Household[]; hid?: string } = {}): {
  switchTo: (next: string) => void;
} {
  const households = opts.households ?? TEST_HOUSEHOLDS;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const tree = (id: string): ReactElement => (
    <QueryClientProvider client={qc}>
      <HouseholdTestProvider
        value={makeHouseholdValue({
          households,
          activeHousehold: households.find((h) => h.id === id) ?? null,
        })}
      >
        <MemoryRouter initialEntries={['/bills/confirmed']}>
          <Routes>
            <Route path="/bills/confirmed" element={<ConfirmedBills />} />
          </Routes>
        </MemoryRouter>
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
  const { rerender } = render(tree(opts.hid ?? TEST_HID));
  return { switchTo: (next) => rerender(tree(next)) };
}

function fixture(
  id: string,
  status: BillResponseDto['status'] = 'confirmed'
): BillResponseDto {
  return {
    id,
    bill_date: '2026-05-19',
    total_amount: 10,
    amount_mismatch: false,
    currency: 'EUR',
    description: `bill ${id}`,
    market: { id: 'm1', name: 'Lidl', city: null },
    created_at: '2026-05-19T10:00:00Z',
    status,
  };
}

const page = (
  bills: BillResponseDto[],
  n = 1,
  totalPages = 1
): [number, unknown] => [
  200,
  {
    data: bills,
    meta: { total: bills.length, page: n, limit: 20, total_pages: totalPages },
  },
];

async function pickTargetAndMove(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: /move…/i }));
  await userEvent.click(
    await screen.findByRole('radio', { name: /family budget/i })
  );
  await userEvent.click(screen.getByRole('button', { name: /^move$/i }));
}

describe('BillsListPage selection', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    vi.clearAllMocks();
    mock = new MockAdapter(apiClient);
    mock.onGet(/\/markets$/).reply(200, []);
  });
  afterEach(() => mock.restore());

  it('has no Select with one budget', async () => {
    mock.onGet('/households/hh-1/bills').reply(() => page([fixture('b1')]));
    renderList({ households: TEST_HOUSEHOLDS.slice(0, 1) });
    await screen.findByText('bill b1');
    expect(screen.queryByRole('button', { name: /^select$/i })).toBeNull();
  });

  it('has no Select when the page has only duplicates', async () => {
    mock
      .onGet('/households/hh-1/bills')
      .reply(() => page([fixture('d1', 'duplicate')]));
    renderList();
    await screen.findByText('bill d1');
    expect(screen.queryByRole('button', { name: /^select$/i })).toBeNull();
  });

  it('Select shows the bar; select all on page skips duplicates', async () => {
    mock
      .onGet('/households/hh-1/bills')
      .reply(() =>
        page([fixture('b1'), fixture('b2'), fixture('d1', 'duplicate')])
      );
    renderList();
    await userEvent.click(
      await screen.findByRole('button', { name: /^select$/i })
    );
    expect(screen.getByText(/0 selected/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /move…/i })).toBeDisabled();
    await userEvent.click(
      screen.getByRole('checkbox', { name: /select all on page/i })
    );
    expect(screen.getByText(/2 selected/i)).toBeVisible();
    expect(
      screen.getByRole('checkbox', { name: /select all on page/i })
    ).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByText(/selected/i)).toBeNull();
  });

  it('changing page clears selection', async () => {
    mock.onGet('/households/hh-1/bills').reply((config) => {
      const p = config.params as Record<string, unknown>;
      return p.page === '2'
        ? page([fixture('p2')], 2, 2)
        : page([fixture('b1')], 1, 2);
    });
    renderList();
    await userEvent.click(
      await screen.findByRole('button', { name: /^select$/i })
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: /select all on page/i })
    );
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText('bill p2');
    expect(screen.queryByText(/selected/i)).toBeNull();
  });

  it('changing a filter clears selection', async () => {
    mock.onGet('/households/hh-1/bills').reply(() => page([fixture('b1')]));
    renderList();
    await userEvent.click(
      await screen.findByRole('button', { name: /^select$/i })
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: /select all on page/i })
    );
    await userEvent.click(screen.getByLabelText('Show duplicates'));
    await waitFor(() => expect(screen.queryByText(/selected/i)).toBeNull());
  });

  it('switching budget clears selection', async () => {
    mock.onGet('/households/hh-1/bills').reply(() => page([fixture('b1')]));
    mock.onGet('/households/hh-2/bills').reply(() => page([fixture('x1')]));
    const { switchTo } = renderList();
    await userEvent.click(
      await screen.findByRole('button', { name: /^select$/i })
    );
    switchTo('hh-2');
    await screen.findByText('bill x1');
    expect(screen.queryByText(/selected/i)).toBeNull();
  });

  it('move success toasts and leaves selection mode', async () => {
    mock
      .onGet('/households/hh-1/bills')
      .reply(() => page([fixture('b1'), fixture('b2')]));
    mock.onPost('/households/hh-1/bills/move').reply(200, {
      target_household_id: 'hh-2',
      bills: ['b1', 'b2'].map((id) => ({
        id,
        lines_total: 1,
        lines_lost_category: 0,
        lines_lost_sub_category: 0,
        already_moved: false,
      })),
    });
    renderList();
    await userEvent.click(
      await screen.findByRole('button', { name: /^select$/i })
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: /select all on page/i })
    );
    await pickTargetAndMove();

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Moved 2 bills to “Family Budget”',
        })
      )
    );
    expect(JSON.parse(mock.history.post[0]?.data as string)).toEqual({
      bill_ids: ['b1', 'b2'],
      target_household_id: 'hh-2',
    });
    expect(screen.queryByText(/selected/i)).toBeNull();
  });

  it('409 keeps selection and Unselect these drops the conflicting ids', async () => {
    mock
      .onGet('/households/hh-1/bills')
      .reply(() => page([fixture('b1'), fixture('b2')]));
    mock.onPost('/households/hh-1/bills/move').reply(409, {
      conflicts: [{ id: 'b1', reason: 'has_duplicates' }],
    });
    renderList();
    await userEvent.click(
      await screen.findByRole('button', { name: /^select$/i })
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: /select all on page/i })
    );
    await pickTargetAndMove();

    await screen.findByRole('heading', { name: /nothing was moved/i });
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: /unselect these/i })
    );
    expect(screen.getByText(/1 selected/i)).toBeVisible();
  });
});
