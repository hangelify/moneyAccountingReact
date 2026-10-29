import '@/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { HouseholdTestProvider } from '@/test/household';
import type { BillDetailResponseDto } from '@/types/bills';
import { toDraft, type BillDetailDraft } from '../billDetailDraft';
import { BillDetailTable } from './BillDetailTable';

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

const bill: BillDetailResponseDto = {
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

const bodyRows = (): HTMLElement[] => {
  const table = screen.getByRole('table');
  const tbody = table.querySelector('tbody')!;
  return within(tbody).getAllByRole('row');
};

describe('BillDetailTable', () => {
  it('renders a row per item with name, category, count, weight and amount', () => {
    render(
      wrap(<BillDetailTable bill={bill} draft={null} onDraftChange={vi.fn()} />)
    );
    const headers = screen
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toEqual([
      '#',
      'Name',
      'Category',
      'Count',
      'Weight (kg)',
      'Amount',
    ]);
    const [milk, apples] = bodyRows();
    expect(milk).toHaveTextContent('MILK');
    expect(milk).toHaveTextContent('Dairy › milk');
    expect(milk).toHaveTextContent('—');
    expect(milk).toHaveTextContent('2.49 EUR');
    expect(apples).toHaveTextContent('APPLES');
    expect(apples).toHaveTextContent('Uncategorized');
    expect(apples).toHaveTextContent('0.942');
    expect(apples).toHaveTextContent('4.71 EUR');
  });

  it('shows the items total next to the bill total', () => {
    render(
      wrap(<BillDetailTable bill={bill} draft={null} onDraftChange={vi.fn()} />)
    );
    const foot = screen.getByRole('table').querySelector('tfoot')!;
    expect(foot).toHaveTextContent('Items total');
    expect(foot).toHaveTextContent('7.20 EUR');
  });

  it('omits the currency when the bill has none', () => {
    const { currency: _omit, ...noCurrency } = bill;
    render(
      wrap(
        <BillDetailTable
          bill={noCurrency}
          draft={null}
          onDraftChange={vi.fn()}
        />
      )
    );
    expect(screen.getByText('2.49')).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).toBeNull();
  });

  it('shows the no-items message instead of a table', () => {
    render(
      wrap(
        <BillDetailTable
          bill={{ ...bill, items: [] }}
          draft={null}
          onDraftChange={vi.fn()}
        />
      )
    );
    expect(
      screen.getByText('This bill has no line items.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('renders inputs in edit mode and reports changes', async () => {
    const onDraftChange = vi.fn();
    render(
      wrap(
        <BillDetailTable
          bill={bill}
          draft={toDraft(bill)}
          onDraftChange={onDraftChange}
        />
      )
    );
    expect(
      screen.getByRole('spinbutton', { name: 'Item 1 amount' })
    ).toHaveValue(2.49);
    expect(screen.getByText('MILK')).toBeInTheDocument();
    await userEvent.type(
      screen.getByRole('spinbutton', { name: 'Item 2 count' }),
      '2'
    );
    const last = onDraftChange.mock.lastCall?.[0] as BillDetailDraft;
    expect(last.items[1]?.count).toBe('12');
  });

  it('footer sums the draft amounts while editing', () => {
    const draft = toDraft(bill);
    draft.items[0]!.amount = 'abc';
    render(
      wrap(
        <BillDetailTable bill={bill} draft={draft} onDraftChange={vi.fn()} />
      )
    );
    const foot = screen.getByRole('table').querySelector('tfoot')!;
    expect(foot).toHaveTextContent('4.71 EUR');
    expect(foot).not.toHaveTextContent('NaN');
  });
});
