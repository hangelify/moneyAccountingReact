import '@/i18n';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { HouseholdTestProvider } from '@/test/household';
import type { BillDetailResponseDto } from '@/types/bills';
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
    render(wrap(<BillDetailTable bill={bill} />));
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
    render(wrap(<BillDetailTable bill={bill} />));
    const foot = screen.getByRole('table').querySelector('tfoot')!;
    expect(foot).toHaveTextContent('Items total');
    expect(foot).toHaveTextContent('7.20 EUR');
  });

  it('omits the currency when the bill has none', () => {
    const { currency: _omit, ...noCurrency } = bill;
    render(wrap(<BillDetailTable bill={noCurrency} />));
    expect(screen.getByText('2.49')).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).toBeNull();
  });

  it('shows the no-items message instead of a table', () => {
    render(wrap(<BillDetailTable bill={{ ...bill, items: [] }} />));
    expect(
      screen.getByText('This bill has no line items.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('BillDetailTable household currency', () => {
  const foreign: BillDetailResponseDto = {
    ...bill,
    bill_date: '2026-10-31',
    currency: 'MDL',
    total_amount: 922.22,
    status: 'confirmed',
    household_currency: 'EUR',
    household_amount: 45.89,
    exchange_rate: { rate: 0.049763, rate_date: '2026-10-31' },
  };

  it('shows the total in the household currency with the rate', async () => {
    render(wrap(<BillDetailTable bill={foreign} />));
    const amount = screen.getByText('≈ 45.89 EUR');
    await userEvent.hover(amount);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      '1 MDL = 0.049763 EUR · rate of Oct 31, 2026'
    );
  });

  it('says not converted yet when no rate is available', () => {
    render(
      wrap(
        <BillDetailTable
          bill={{ ...foreign, household_amount: null, exchange_rate: null }}
        />
      )
    );
    expect(screen.getByText('Not converted yet.')).toBeInTheDocument();
  });
});
