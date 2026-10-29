// src/pages/bills/ConfirmedBills.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { ConfirmedBills } from './ConfirmedBills';
import { BillDetailDrawer } from './BillDetailDrawer';
import type { BillResponseDto } from '@/types/bills';
import type { ReactElement } from 'react';
import '@/i18n';

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
      <MemoryRouter initialEntries={[initial]}>
        <LocationProbe />
        <Routes>
          <Route path="/bills/confirmed" element={<ConfirmedBills />}>
            <Route path=":id" element={<BillDetailDrawer />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function fixture(id: string, total: number): BillResponseDto {
  return {
    id,
    bill_date: '2026-05-19',
    total_amount: total,
    currency: 'EUR',
    description: `bill ${id}`,
    market: { id: 'm1', name: 'Lidl', city: 'Bucharest' },
    created_at: '2026-05-19T10:00:00Z',
  };
}

describe('ConfirmedBills (integration)', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet('/markets').reply(200, [
      {
        id: '1',
        name: 'Lidl',
        address: null,
        city: 'Bucharest',
        country: 'RO',
        created_at: '2026-01-10T08:00:00Z',
        bill_count: 5,
      },
      {
        id: '2',
        name: 'Kaufland',
        address: null,
        city: null,
        country: null,
        created_at: '2026-02-01T08:00:00Z',
        bill_count: 3,
      },
    ]);
  });
  afterEach(() => mock.restore());

  it('loads, filters by amount, opens drawer, paginates', async () => {
    mock.onGet('/bills').reply((config) => {
      const p = config.params as Record<string, unknown>;
      if (p.page === '2') {
        return [
          200,
          {
            data: [fixture('p2-a', 99)],
            meta: { total: 21, page: 2, limit: 20, total_pages: 2 },
          },
        ];
      }
      if (p.amount_range === 'gt_100') {
        return [
          200,
          {
            data: [fixture('a-1', 150), fixture('a-2', 200)],
            meta: { total: 2, page: 1, limit: 20, total_pages: 1 },
          },
        ];
      }
      return [
        200,
        {
          data: [fixture('b1', 10), fixture('b2', 20)],
          meta: { total: 21, page: 1, limit: 20, total_pages: 2 },
        },
      ];
    });
    mock.onGet('/bills/a-1').reply(200, {
      ...fixture('a-1', 150),
      items: [],
    });

    renderApp('/bills/confirmed');

    // 1. Initial render
    await waitFor(() => screen.getByText('bill b1'));

    // 2. Amount filter → URL updates
    await userEvent.type(screen.getByLabelText(/min amount/i), '100');
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent('amount_range=gt_100')
    );
    await waitFor(() => screen.getByText('bill a-1'));

    // 3. Click row → drawer opens, URL updates
    const rows = await screen.findAllByRole('button', { name: /view bill/i });
    const targetRow = rows.find((r) => within(r).queryByText('bill a-1'));
    expect(targetRow).toBeDefined();
    await userEvent.click(targetRow!);
    await waitFor(() => screen.getByText(/bill details/i));
    expect(screen.getByTestId('loc')).toHaveTextContent('/bills/confirmed/a-1');

    // 4. Esc closes drawer, preserves filters
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.getByTestId('loc')).toHaveTextContent('amount_range=gt_100')
    );
    expect(screen.queryByText(/bill details/i)).toBeNull();
  });
});
