import '@/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { HOUSEHOLDS_KEY, HouseholdProvider } from '@/contexts/HouseholdContext';
import { HouseholdSwitcher } from './HouseholdSwitcher';
import { useBillDetail } from '@/hooks/useBillDetail';
import { ConfirmedBills } from '@/pages/bills/ConfirmedBills';
import { householdsApi } from '@/api/households';
import { billsApi } from '@/api/bills';
import type * as toastModule from '@/components/ui/use-toast';
import { toast } from '@/components/ui/use-toast';
import { TEST_HOUSEHOLDS } from '@/test/household';
import type { BillResponseDto } from '@/types/bills';
import type { Paginated } from '@/types/pagination';
import type { ReactElement } from 'react';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));
vi.mock('@/api/households', () => ({ householdsApi: { list: vi.fn() } }));
vi.mock('@/api/bills', () => ({
  billsApi: { list: vi.fn(), detail: vi.fn() },
}));
vi.mock('@/components/ui/use-toast', async (importOriginal) => {
  const actual = await importOriginal<typeof toastModule>();
  return { ...actual, toast: vi.fn() };
});

const list = vi.mocked(householdsApi.list);
const billsList = vi.mocked(billsApi.list);
const billDetail = vi.mocked(billsApi.detail);

function page(description: string): Paginated<BillResponseDto> {
  return {
    data: [
      {
        id: `b-${description}`,
        bill_date: '2026-05-19',
        total_amount: 10,
        amount_mismatch: false,
        currency: 'EUR',
        description,
        market: null,
        created_at: '2026-05-19T10:00:00Z',
      },
    ],
    meta: { total: 1, page: 1, limit: 20, total_pages: 1 },
  };
}

function renderApp(): QueryClient {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  const tree: ReactElement = (
    <QueryClientProvider client={qc}>
      <HouseholdProvider>
        <MemoryRouter initialEntries={['/bills/confirmed']}>
          <HouseholdSwitcher />
          <ConfirmedBills />
        </MemoryRouter>
      </HouseholdProvider>
    </QueryClientProvider>
  );
  render(tree);
  return qc;
}

function DetailProbe(): ReactElement {
  const { id } = useParams();
  useBillDetail(id);
  return <p>Bill {id}</p>;
}

describe('budget switching isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('activeHouseholdId', 'hh-1');
    list.mockReset().mockResolvedValue(TEST_HOUSEHOLDS);
    vi.mocked(toast).mockClear();
    billsList.mockReset().mockImplementation(async (hid) => {
      if (hid === 'hh-2') {
        await new Promise((r) => setTimeout(r, 30));
        return page('Beta');
      }
      return page('Alpha');
    });
  });

  it('never shows the previous budget bills after a switch', async () => {
    renderApp();
    expect(await screen.findByText('Alpha')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Budget:/ }));
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: /Family Budget/ })
    );

    expect(screen.queryByText('Alpha')).toBeNull();
    expect(await screen.findByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).toBeNull();
    expect(localStorage.getItem('activeHouseholdId')).toBe('hh-2');
  });

  it('falls back to the remaining budget silently when the active one disappears', async () => {
    const qc = renderApp();
    expect(
      await screen.findByRole('button', { name: 'Budget: Personal' })
    ).toBeInTheDocument();

    // Same cache edit useDeleteHousehold makes after deleting the active one.
    act(() => {
      qc.setQueryData(HOUSEHOLDS_KEY, TEST_HOUSEHOLDS.slice(1));
    });

    expect(
      await screen.findByRole('button', { name: 'Budget: Family Budget' })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(localStorage.getItem('activeHouseholdId')).toBe('hh-2')
    );
    expect(toast).not.toHaveBeenCalled();
  });

  it('a switch on a bill page never fetches that bill in the new budget', async () => {
    billDetail.mockReset().mockReturnValue(new Promise(() => undefined));
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <HouseholdProvider>
          <MemoryRouter initialEntries={['/bills/confirmed/b1']}>
            <HouseholdSwitcher />
            <Routes>
              <Route path="/bills/confirmed/:id" element={<DetailProbe />} />
              <Route path="/bills/confirmed" element={<ConfirmedBills />} />
            </Routes>
          </MemoryRouter>
        </HouseholdProvider>
      </QueryClientProvider>
    );
    await waitFor(() => expect(billDetail).toHaveBeenCalledWith('hh-1', 'b1'));

    await userEvent.click(screen.getByRole('button', { name: /Budget:/ }));
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: /Family Budget/ })
    );

    expect(await screen.findByText('Beta')).toBeInTheDocument();
    expect(billDetail).not.toHaveBeenCalledWith('hh-2', 'b1');
  });
});
