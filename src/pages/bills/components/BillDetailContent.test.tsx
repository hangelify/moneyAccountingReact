import '@/i18n';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { BillDetailContent } from './BillDetailContent';
import { useState, type ReactElement, type ReactNode } from 'react';
import { HouseholdTestProvider } from '@/test/household';
import type { BillDetailResponseDto } from '@/types/bills';
import { toDraft } from '../billDetailDraft';

function wrap(ui: ReactNode): ReactElement {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={qc}>
      <HouseholdTestProvider>{ui}</HouseholdTestProvider>
    </QueryClientProvider>
  );
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
    mock.onGet('/households/hh-1/bills/b1').reply(200, {
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
    mock
      .onGet('/households/hh-1/bills/missing')
      .reply(404, { message: 'Bill not found' });
    render(wrap(<BillDetailContent id="missing" />));
    await waitFor(() => screen.getByText(/bill not found/i));
  });

  it('shows generic error + retry on 500', async () => {
    mock.onGet('/households/hh-1/bills/x').reply(500);
    render(wrap(<BillDetailContent id="x" />));
    await waitFor(() => screen.getByRole('button', { name: /retry/i }));
    mock.onGet('/households/hh-1/bills/x').reply(200, {
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

  it('falls back to market_name_raw when the bill has no linked market', async () => {
    mock.onGet('/households/hh-1/bills/d1').reply(200, {
      id: 'd1',
      bill_date: '2026-10-29',
      total_amount: 3,
      currency: 'MDL',
      amount_mismatch: false,
      description: null,
      created_at: '2026-10-29T14:03:44.885Z',
      status: 'draft',
      market_name_raw: 'N-1 Supermarket',
      bill_date_inferred: true,
      items: [],
    });
    render(wrap(<BillDetailContent id="d1" />));
    await waitFor(() => screen.getByText('N-1 Supermarket'));
  });

  // Owns the draft the way the drawer does while editing.
  function Editing({ bill }: { bill: BillDetailResponseDto }): ReactElement {
    const [draft, setDraft] = useState(() => toDraft(bill));
    return (
      <BillDetailContent id={bill.id} draft={draft} onDraftChange={setDraft} />
    );
  }

  const editableBill: BillDetailResponseDto = {
    id: 'e1',
    bill_date: '2026-05-19T00:00:00Z',
    total_amount: 52.3,
    currency: 'EUR',
    description: null,
    market: { id: 'm1', name: 'Lidl', city: null },
    created_at: '2026-05-19T10:00:00Z',
    amount_mismatch: false,
    items: [
      {
        id: 'l1',
        raw_name: 'MILK',
        sub_category: { id: 's1', name: 'milk', category_name: 'Dairy' },
        product_count: 2,
        amount: 14.5,
        product_weight: 1,
      },
    ],
  };

  it('renders no inputs in view mode', async () => {
    mock.onGet('/households/hh-1/bills/e1').reply(200, editableBill);
    render(wrap(<BillDetailContent id="e1" />));
    await waitFor(() => screen.getByText('Lidl'));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  it('renders market, date, total and item inputs in edit mode', async () => {
    mock.onGet('/households/hh-1/bills/e1').reply(200, editableBill);
    render(wrap(<Editing bill={editableBill} />));
    await waitFor(() => screen.getByLabelText('Market'));
    expect(screen.getByLabelText('Market')).toHaveValue('Lidl');
    expect(screen.getByLabelText('Date')).toHaveValue('2026-05-19');
    expect(screen.getByLabelText('Total')).toHaveValue(52.3);
    expect(screen.getByLabelText('Item 1 amount')).toHaveValue(14.5);
    expect(screen.getByLabelText('Item 1 count')).toHaveValue(2);
    expect(screen.getByLabelText('Item 1 weight (kg)')).toHaveValue(1);
  });

  it('lets the item sub-category be changed from the fetched list', async () => {
    mock.onGet('/households/hh-1/bills/e1').reply(200, editableBill);
    mock.onGet('/households/hh-1/sub-categories').reply(200, [
      {
        id: 's1',
        name: 'milk',
        category_id: 'c1',
        category_name: 'Dairy',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 's2',
        name: 'cheese',
        category_id: 'c1',
        category_name: 'Dairy',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    render(wrap(<Editing bill={editableBill} />));
    const select = await screen.findByLabelText('Item 1 category');
    await waitFor(() => expect(select).toBeEnabled());
    expect(select).toHaveValue('s1');
    await userEvent.selectOptions(select, 's2');
    expect(select).toHaveValue('s2');
  });
});
