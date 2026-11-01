import '@/i18n';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BillDetailResponseDto } from '@/types/bills';
import { BillDetailViews } from './BillDetailViews';

const bill: BillDetailResponseDto = {
  id: 'b1',
  bill_date: '2026-10-28',
  total_amount: 7.2,
  amount_mismatch: false,
  currency: 'EUR',
  created_at: '2026-10-28T10:00:00Z',
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
      product_weight: null,
    },
  ],
};

function renderViews(
  props: Partial<Parameters<typeof BillDetailViews>[0]> = {}
): void {
  render(
    <BillDetailViews bill={bill} editing={false} {...props}>
      <p>items table</p>
    </BillDetailViews>
  );
}

describe('BillDetailViews', () => {
  it('opens on the Items tab', () => {
    renderViews();
    expect(screen.getByRole('tab', { name: 'Items' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText('items table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Dairy,/ })).toBeNull();
  });

  it('shows the bill as a chart on the Chart tab', async () => {
    renderViews();
    await userEvent.click(screen.getByRole('tab', { name: 'Chart' }));
    expect(screen.queryByText('items table')).toBeNull();
    expect(
      screen.getByRole('button', { name: /^Dairy, €2\.49, 34\.58%$/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Uncategorized, €4\.71/ })
    ).toBeInTheDocument();
  });

  it('zooms into a category and back', async () => {
    renderViews();
    await userEvent.click(screen.getByRole('tab', { name: 'Chart' }));
    await userEvent.click(screen.getByRole('button', { name: /^Dairy,/ }));
    // Zoomed: only Dairy and its sub-categories are left in the rings.
    expect(
      screen.queryAllByRole('button', { name: /^Uncategorized,/ })
    ).toHaveLength(0);
    await userEvent.click(
      screen.getByRole('button', { name: 'All categories' })
    );
    expect(
      screen.getAllByRole('button', { name: /^Uncategorized,/ })
    ).toHaveLength(1);
  });

  it('shows the no-items message for an empty bill', async () => {
    renderViews({ bill: { ...bill, items: [] } });
    await userEvent.click(screen.getByRole('tab', { name: 'Chart' }));
    expect(
      screen.getByText('This bill has no line items.')
    ).toBeInTheDocument();
  });

  it('stays on Items and disables Chart while editing', () => {
    renderViews({ editing: true });
    expect(screen.getByRole('tab', { name: 'Chart' })).toBeDisabled();
    expect(screen.getByText('items table')).toBeInTheDocument();
  });

  it('goes back to Items when editing starts on the Chart tab', async () => {
    const { rerender } = render(
      <BillDetailViews bill={bill} editing={false}>
        <p>items table</p>
      </BillDetailViews>
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Chart' }));
    rerender(
      <BillDetailViews bill={bill} editing>
        <p>items table</p>
      </BillDetailViews>
    );
    expect(screen.getByText('items table')).toBeInTheDocument();
  });
});
