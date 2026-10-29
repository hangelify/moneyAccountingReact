import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillCard } from './BillCard';
import type { BillResponseDto } from '@/types/bills';
import '@/i18n';

const bill: BillResponseDto = {
  id: 'b1',
  bill_date: '2026-05-19',
  total_amount: 23.4,
  amount_mismatch: false,
  currency: 'EUR',
  description: 'Weekly groceries',
  market: { id: 'm1', name: 'Lidl', city: 'Bucharest' },
  created_at: '2026-05-19T10:21:03.000Z',
  items_count: 5,
};

describe('BillCard', () => {
  it('shows date, market, amount with currency and items count', () => {
    render(<BillCard bill={bill} onClick={vi.fn()} />);
    expect(screen.getByText('2026-05-19')).toBeInTheDocument();
    expect(screen.getByText('Lidl')).toBeInTheDocument();
    expect(screen.getByText('23.40')).toBeInTheDocument();
    expect(screen.getByText('EUR')).toBeInTheDocument();
    expect(screen.getByText('5 items')).toBeInTheDocument();
  });

  it('uses the singular form for one item', () => {
    render(<BillCard bill={{ ...bill, items_count: 1 }} onClick={vi.fn()} />);
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  it('hides the count when the API does not send items_count', () => {
    const { items_count: _omit, ...rest } = bill;
    render(<BillCard bill={rest} onClick={vi.fn()} />);
    expect(screen.queryByText(/items?$/)).toBeNull();
  });

  it('falls back when market and currency are absent', () => {
    render(
      <BillCard
        bill={{ ...bill, market: null, currency: null }}
        onClick={vi.fn()}
      />
    );
    expect(screen.getByText('No market')).toBeInTheDocument();
    expect(screen.queryByText('EUR')).toBeNull();
  });

  it('shows a badge only when the amounts mismatch', () => {
    const { rerender } = render(<BillCard bill={bill} onClick={vi.fn()} />);
    expect(screen.queryByText(/don't add up/i)).toBeNull();
    rerender(
      <BillCard bill={{ ...bill, amount_mismatch: true }} onClick={vi.fn()} />
    );
    expect(screen.getByText(/don't add up/i)).toBeInTheDocument();
  });

  it('is a button that reports its bill id on click', async () => {
    const onClick = vi.fn();
    render(<BillCard bill={bill} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: /view bill/i }));
    expect(onClick).toHaveBeenCalledWith('b1');
  });
});
