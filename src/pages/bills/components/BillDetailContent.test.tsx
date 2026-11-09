import '@/i18n';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { BillDetailContent } from './BillDetailContent';
import { useState, type ReactElement, type ReactNode } from 'react';
import { HouseholdTestProvider, makeHouseholdValue } from '@/test/household';
import type { BillDetailResponseDto } from '@/types/bills';
import { billToEdits } from '../billDetailEdits';
import { addDays } from '@/lib/isoDate';
import { localIsoDate } from '@/pages/dashboard/period';

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

  it('shows loading while the household is not ready yet', () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <HouseholdTestProvider
          value={makeHouseholdValue({
            status: 'loading',
            activeHousehold: null,
          })}
        >
          <BillDetailContent id="b1" />
        </HouseholdTestProvider>
      </QueryClientProvider>
    );
    expect(screen.getByText('Loading bill…')).toBeInTheDocument();
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

  it('shows a line with only a category by the category name', async () => {
    mock.onGet('/households/hh-1/bills/b1').reply(200, {
      id: 'b1',
      bill_date: '2026-05-19T00:00:00Z',
      total_amount: 30,
      currency: 'EUR',
      market: { id: 'm1', name: 'Lidl', city: null },
      created_at: '2026-05-19T10:00:00Z',
      items: [
        {
          sub_category: null,
          category: { id: 'c1', name: 'Dairy' },
          product_count: 1,
          amount: 30,
          product_weight: null,
        },
      ],
    });
    render(wrap(<BillDetailContent id="b1" />));
    await waitFor(() => screen.getByText('Lidl'));
    expect(screen.getByText('Dairy')).toBeInTheDocument();
    expect(screen.queryByText(/uncategorized/i)).not.toBeInTheDocument();
  });

  it('shows the bill as a chart on the Chart tab', async () => {
    mock.onGet('/households/hh-1/bills/b1').reply(200, {
      id: 'b1',
      bill_date: '2026-05-19T00:00:00Z',
      total_amount: 10,
      currency: 'EUR',
      created_at: '2026-05-19T10:00:00Z',
      items: [
        {
          sub_category: { id: 's1', name: 'milk', category_name: 'Dairy' },
          product_count: 1,
          amount: 10,
          product_weight: null,
        },
      ],
    });
    render(wrap(<BillDetailContent id="b1" />));
    await userEvent.click(await screen.findByRole('tab', { name: 'Chart' }));
    expect(
      screen.getByRole('button', { name: /^Dairy, €10\.00, 100\.00%$/ })
    ).toBeInTheDocument();
  });

  describe('household currency', () => {
    const reply = (
      extra: Partial<Record<keyof BillDetailResponseDto, unknown>>
    ): void => {
      mock.onGet('/households/hh-1/bills/b1').reply(200, {
        id: 'b1',
        bill_date: '2026-10-30',
        total_amount: 50,
        currency: 'EUR',
        created_at: '2026-10-30T10:00:00Z',
        items: [],
        household_currency: 'MDL',
        ...extra,
      });
    };
    const loaded = async (): Promise<void> => {
      await screen.findAllByText(/50\.00/);
    };
    const NO_CURRENCY = 'Set a currency to convert this bill.';
    const FUTURE = 'Check the bill date — no exchange rate for a future date.';
    const PENDING = 'Not converted yet.';
    const notes = [NO_CURRENCY, FUTURE, PENDING];

    it('shows the converted total with the rate in a tooltip', async () => {
      reply({
        household_amount: 1009.95,
        exchange_rate: { rate: 20.1989, rate_date: '2026-10-30' },
      });
      render(wrap(<BillDetailContent id="b1" />));
      const amount = await screen.findByText('≈ 1,009.95 MDL');
      await userEvent.hover(amount);
      expect(await screen.findByRole('tooltip')).toHaveTextContent(
        '1 EUR = 20.1989 MDL · rate of Oct 30, 2026'
      );
    });

    it('asks for a currency when the bill has none', async () => {
      reply({ currency: null, household_amount: null, exchange_rate: null });
      render(wrap(<BillDetailContent id="b1" />));
      expect(await screen.findByText(NO_CURRENCY)).toBeInTheDocument();
    });

    it('flags a bill date in the future', async () => {
      reply({
        bill_date: addDays(localIsoDate(), 1),
        household_amount: null,
        exchange_rate: null,
      });
      render(wrap(<BillDetailContent id="b1" />));
      expect(await screen.findByText(FUTURE)).toBeInTheDocument();
    });

    it('says not converted yet when no rate is available', async () => {
      reply({ household_amount: null, exchange_rate: null });
      render(wrap(<BillDetailContent id="b1" />));
      expect(await screen.findByText(PENDING)).toBeInTheDocument();
    });

    it('adds nothing for a bill in the household currency', async () => {
      reply({
        household_currency: 'EUR',
        household_amount: 50,
        exchange_rate: null,
      });
      render(wrap(<BillDetailContent id="b1" />));
      await loaded();
      expect(screen.queryByText(/≈/)).toBeNull();
      for (const n of notes) expect(screen.queryByText(n)).toBeNull();
    });

    it('adds nothing when the API sends no household fields', async () => {
      reply({ household_currency: undefined });
      render(wrap(<BillDetailContent id="b1" />));
      await loaded();
      for (const n of notes) expect(screen.queryByText(n)).toBeNull();
    });
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

  // Owns the edits the way the drawer does while editing.
  function Editing({ bill }: { bill: BillDetailResponseDto }): ReactElement {
    const [edits, setEdits] = useState(() => billToEdits(bill));
    return (
      <BillDetailContent id={bill.id} edits={edits} onEditsChange={setEdits} />
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

  it('renders the review form in edit mode', async () => {
    mock.onGet('/households/hh-1/bills/e1').reply(200, editableBill);
    render(wrap(<Editing bill={editableBill} />));
    expect(await screen.findByLabelText('Market name')).toHaveValue('Lidl');
    expect(screen.getByLabelText('Date')).toHaveValue('2026-05-19');
    expect(screen.getByLabelText('Total amount')).toHaveValue('52.3');
    expect(screen.getAllByTestId('item-final-price-0')[0]).toHaveValue('14.5');
    expect(
      screen.getAllByRole('button', { name: /delete item/i }).length
    ).toBeGreaterThan(0);
  });

  it('warns in view mode when the items do not match the total', async () => {
    mock.onGet('/households/hh-1/bills/e1').reply(200, editableBill);
    render(wrap(<BillDetailContent id="e1" />));
    expect(
      await screen.findByText("Items don't match the bill total")
    ).toBeInTheDocument();
  });
});
