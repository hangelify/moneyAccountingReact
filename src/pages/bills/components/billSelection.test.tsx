// Selection mode of the bill cards and the confirmed-bills table.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@/i18n';
import type { BillResponseDto } from '@/types/bills';
import type { BillSelectionView } from '../move/useBillSelection';
import { BillCardGrid } from './BillCardGrid';
import { ConfirmedBillsTable } from './ConfirmedBillsTable';

function bill(
  id: string,
  status: BillResponseDto['status'] = 'confirmed'
): BillResponseDto {
  return {
    id,
    bill_date: '2026-05-19',
    total_amount: 10,
    amount_mismatch: false,
    currency: 'EUR',
    description: `bill ${id}`,
    market: { id: 'm1', name: `Shop ${id}`, city: null },
    created_at: '2026-05-19T10:00:00Z',
    status,
  };
}

function view(
  selected: string[] = [],
  over: Partial<BillSelectionView> = {}
): BillSelectionView {
  return {
    isSelected: (id) => selected.includes(id),
    toggle: vi.fn(),
    isSelectable: (b) => b.status !== 'duplicate',
    ...over,
  };
}

describe('BillCardGrid selection', () => {
  it('a card in selection mode toggles instead of opening', async () => {
    const onCardClick = vi.fn();
    const selection = view(['a']);
    render(
      <BillCardGrid
        bills={[bill('a'), bill('b')]}
        onCardClick={onCardClick}
        selection={selection}
      />
    );
    const [a, b] = screen.getAllByRole('checkbox') as [
      HTMLElement,
      HTMLElement,
    ];
    expect(a).toHaveAttribute('aria-checked', 'true');
    expect(b).toHaveAccessibleName('Select Shop b, 2026-05-19, 10.00 EUR');
    expect(b).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(b);
    expect(selection.toggle).toHaveBeenCalledWith('b');
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('a duplicate card is not selectable', async () => {
    const onCardClick = vi.fn();
    const selection = view();
    render(
      <BillCardGrid
        bills={[bill('d', 'duplicate')]}
        onCardClick={onCardClick}
        selection={selection}
      />
    );
    expect(screen.queryByRole('checkbox')).toBeNull();
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(card);
    expect(selection.toggle).not.toHaveBeenCalled();
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('without selection a card opens the bill', async () => {
    const onCardClick = vi.fn();
    render(<BillCardGrid bills={[bill('a')]} onCardClick={onCardClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onCardClick).toHaveBeenCalledWith('a');
  });
});

describe('ConfirmedBillsTable selection', () => {
  it('a row in selection mode toggles on click and Space', async () => {
    const onRowClick = vi.fn();
    const selection = view();
    render(
      <ConfirmedBillsTable
        bills={[bill('a')]}
        onRowClick={onRowClick}
        selection={selection}
      />
    );
    const row = screen.getByRole('checkbox', {
      name: 'Select Shop a, 2026-05-19, 10.00 EUR',
    });
    expect(row).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(row);
    row.focus();
    await userEvent.keyboard(' ');
    expect(selection.toggle).toHaveBeenCalledTimes(2);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('a duplicate row has no checkbox and does not toggle', async () => {
    const selection = view();
    render(
      <ConfirmedBillsTable
        bills={[bill('d', 'duplicate')]}
        onRowClick={vi.fn()}
        selection={selection}
      />
    );
    const row = screen.getByText('bill d').closest('tr');
    if (!row) throw new Error('no row');
    expect(row).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(row);
    expect(selection.toggle).not.toHaveBeenCalled();
  });

  it('without selection the row opens the bill', async () => {
    const onRowClick = vi.fn();
    render(<ConfirmedBillsTable bills={[bill('a')]} onRowClick={onRowClick} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    await userEvent.click(screen.getByRole('button'));
    expect(onRowClick).toHaveBeenCalledWith('a');
  });
});
