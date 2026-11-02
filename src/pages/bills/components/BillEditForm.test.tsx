import '@/i18n';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';
import MockAdapter from 'axios-mock-adapter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient } from '@/auth/apiClient';
import { HouseholdTestProvider } from '@/test/household';
import type { BillEditItem, BillEdits } from '@/types/bills';
import { BillEditForm } from './BillEditForm';

function makeItem(overrides: Partial<BillEditItem>): BillEditItem {
  return {
    name: 'Bread',
    quantity: 1,
    unit: 'piece',
    weight_kg: null,
    price_per_kg: null,
    final_price: 1,
    sub_category: null,
    category_confidence: 1,
    ...overrides,
  };
}

function makeEdits(overrides: Partial<BillEdits> = {}): BillEdits {
  return {
    market_name: 'Lidl',
    bill_date: '2026-10-28',
    currency: 'EUR',
    total_amount: 7.2,
    items: [
      makeItem({ id: 'l1', name: 'MILK', final_price: 2.49 }),
      makeItem({ id: 'l2', name: 'APPLES', final_price: 4.71 }),
    ],
    fiscal_register_id: '',
    fiscal_receipt_number: '',
    purchase_time: '',
    ...overrides,
  };
}

// Keeps the edits in state the way the pages do.
function Host({ initial }: { initial: BillEdits }): ReactElement {
  const [edits, setEdits] = useState(initial);
  return <BillEditForm edits={edits} onChange={setEdits} />;
}

function renderForm(initial = makeEdits()): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <HouseholdTestProvider>
        <Host initial={initial} />
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
}

describe('BillEditForm', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet(/sub-categories/).reply(200, []);
  });
  afterEach(() => {
    mock.restore();
  });

  it('removes an item after the delete is confirmed', async () => {
    renderForm();
    await userEvent.click(
      screen.getAllByRole('button', { name: /delete item/i })[0]!
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /^confirm$/i,
      })
    );
    await waitFor(() =>
      expect(screen.queryAllByTestId('item-final-price-1')).toHaveLength(0)
    );
    expect(screen.getAllByTestId('item-final-price-0')[0]).toHaveValue(4.71);
  });

  it('adds an empty item', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));
    expect(screen.getAllByTestId('item-final-price-2')[0]).toHaveValue(0);
  });

  it('clears the weight when the unit changes away from kg', async () => {
    const onChange = vi.fn();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const edits = makeEdits({
      items: [
        makeItem({
          id: 'l2',
          name: 'APPLES',
          unit: 'kg',
          weight_kg: 0.942,
          price_per_kg: 5,
          final_price: 4.71,
        }),
      ],
    });
    render(
      <QueryClientProvider client={client}>
        <HouseholdTestProvider>
          <BillEditForm edits={edits} onChange={onChange} />
        </HouseholdTestProvider>
      </QueryClientProvider>
    );
    await userEvent.selectOptions(
      screen.getAllByDisplayValue('kg')[0]!,
      'piece'
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            unit: 'piece',
            weight_kg: null,
            price_per_kg: null,
          }),
        ],
      })
    );
  });

  it('warns when the items do not add up to the total', () => {
    renderForm(makeEdits({ total_amount: 9 }));
    expect(screen.getByText(/items don't match/i)).toBeInTheDocument();
  });

  it('shows no warning when the items add up', () => {
    renderForm();
    expect(screen.queryByText(/items don't match/i)).toBeNull();
  });
});
