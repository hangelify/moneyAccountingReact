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
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/bills/confirmed" element={<LocationProbe />}>
            <Route path=":id" element={<BillDetailDrawer />} />
          </Route>
        </Routes>
      </MemoryRouter>
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
    mock.onGet('/bills/b1').reply(200, {
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
    mock.onGet('/bills/b1').reply(200, {
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
});
