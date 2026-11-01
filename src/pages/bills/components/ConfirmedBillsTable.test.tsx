import '@/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmedBillsTable } from './ConfirmedBillsTable';
import type { BillResponseDto } from '@/types/bills';

const fixtures: BillResponseDto[] = [
  {
    id: 'b1',
    bill_date: '2026-05-19',
    total_amount: 52.3,
    amount_mismatch: false,
    currency: 'EUR',
    description: 'Weekly grocery run',
    market: { id: 'm1', name: 'Lidl', city: 'Bucharest' },
    created_at: '2026-05-19T10:00:00Z',
  },
  {
    id: 'b2',
    bill_date: '2026-05-15',
    total_amount: 12,
    amount_mismatch: false,
    currency: 'EUR',
    description: null,
    market: null,
    created_at: '2026-05-15T10:00:00Z',
  },
];

describe('ConfirmedBillsTable', () => {
  it('shows the household amount for a foreign bill', () => {
    const [first] = fixtures as [BillResponseDto];
    render(
      <ConfirmedBillsTable
        bills={[
          { ...first, household_currency: 'MDL', household_amount: 1056.46 },
        ]}
        onRowClick={vi.fn()}
      />
    );
    expect(screen.getByText('≈ 1,056.46 MDL')).toBeInTheDocument();
  });

  it('renders one row per bill with market or em-dash', () => {
    render(<ConfirmedBillsTable bills={fixtures} onRowClick={vi.fn()} />);
    expect(screen.getByText('Lidl')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('emits id on row click', async () => {
    const onRowClick = vi.fn();
    render(<ConfirmedBillsTable bills={fixtures} onRowClick={onRowClick} />);
    await userEvent.click(
      screen.getAllByRole('button', { name: /view bill/i })[0]!
    );
    expect(onRowClick).toHaveBeenCalledWith('b1');
  });

  it('emits id on Enter and Space keypress', async () => {
    const onRowClick = vi.fn();
    render(<ConfirmedBillsTable bills={fixtures} onRowClick={onRowClick} />);
    const row = screen.getAllByRole('button', { name: /view bill/i })[0]!;
    row.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });
});

describe('ConfirmedBillsTable duplicate', () => {
  it('dims a duplicate row and shows a badge', () => {
    const [first, second] = fixtures as [BillResponseDto, BillResponseDto];
    render(
      <ConfirmedBillsTable
        bills={[
          { ...first, status: 'duplicate', duplicate_of_id: 'b2' },
          second,
        ]}
        onRowClick={vi.fn()}
      />
    );
    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveClass('opacity-60');
    expect(rows[1]).not.toHaveClass('opacity-60');
    expect(screen.getAllByText('Duplicate')).toHaveLength(1);
  });
});

describe('ConfirmedBillsTable duplicate accessibility', () => {
  it('announces a duplicate in the row label', () => {
    const [first, second] = fixtures as [BillResponseDto, BillResponseDto];
    render(
      <ConfirmedBillsTable
        bills={[
          { ...first, status: 'duplicate', duplicate_of_id: 'b2' },
          second,
        ]}
        onRowClick={vi.fn()}
      />
    );
    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveAccessibleName(/duplicate/i);
    expect(rows[1]).not.toHaveAccessibleName(/duplicate/i);
  });
});
