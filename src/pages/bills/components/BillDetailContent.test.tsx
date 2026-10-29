import '@/i18n';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { BillDetailContent } from './BillDetailContent';
import type { ReactElement, ReactNode } from 'react';

function wrap(ui: ReactNode): ReactElement {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe('BillDetailContent', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  it('renders summary and items on success', async () => {
    mock.onGet('/bills/b1').reply(200, {
      id: 'b1',
      bill_date: '2026-05-19T00:00:00Z',
      total_amount: 52.3,
      currency: 'EUR',
      description: 'Weekly grocery run',
      market: { id: 'm1', name: 'Lidl', city: 'Bucharest' },
      created_at: '2026-05-19T10:00:00Z',
      items: [
        {
          sub_category: { id: 's1', name: 'milk', category_name: 'Dairy' },
          product_count: 2,
          amount: 14.5,
          product_weight: 1,
        },
        {
          sub_category: null,
          product_count: 1,
          amount: 37.8,
          product_weight: null,
        },
      ],
    });
    render(wrap(<BillDetailContent id="b1" />));
    await waitFor(() => screen.getByText('Lidl'));
    expect(screen.getByText(/52\.30/)).toBeInTheDocument();
    expect(screen.getByText(/milk/)).toBeInTheDocument();
    expect(screen.getByText(/uncategorized/i)).toBeInTheDocument();
  });

  it('shows "Bill not found" on 404', async () => {
    mock.onGet('/bills/missing').reply(404, { message: 'Bill not found' });
    render(wrap(<BillDetailContent id="missing" />));
    await waitFor(() => screen.getByText(/bill not found/i));
  });

  it('shows generic error + retry on 500', async () => {
    mock.onGet('/bills/x').reply(500);
    render(wrap(<BillDetailContent id="x" />));
    await waitFor(() => screen.getByRole('button', { name: /retry/i }));
    mock.onGet('/bills/x').reply(200, {
      id: 'x',
      bill_date: '2026-05-19',
      total_amount: 10,
      currency: 'EUR',
      description: null,
      market: null,
      created_at: '2026-05-19T10:00:00Z',
      items: [],
    });
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => screen.getByText(/this bill has no line items/i));
  });
});
