import '@/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PossibleDuplicate } from '@/types/bills';
import { DuplicateBanner } from './DuplicateBanner';

const cand = (id: string, name = 'Ana'): PossibleDuplicate => ({
  id,
  bill_date: '2026-10-03',
  total_amount: 412.5,
  currency: 'MDL',
  market_name: 'Linella',
  created_by_name: name,
  match: 'strong',
});

describe('DuplicateBanner', () => {
  it('shows one candidate with Mark and Keep both', async () => {
    const onMark = vi.fn();
    const onKeepBoth = vi.fn();
    render(
      <DuplicateBanner
        candidates={[cand('b0')]}
        onMark={onMark}
        onKeepBoth={onKeepBoth}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Ana already added this on Oct 3'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Mark as duplicate' })
    );
    expect(onMark).toHaveBeenCalledWith(cand('b0'));
    await userEvent.click(screen.getByRole('button', { name: 'Keep both' }));
    expect(onKeepBoth).toHaveBeenCalledWith(cand('b0'));
  });

  it('lists several candidates under a heading', () => {
    render(
      <DuplicateBanner
        candidates={[cand('b0'), cand('b1', 'Ion')]}
        onMark={vi.fn()}
        onKeepBoth={vi.fn()}
      />
    );
    expect(screen.getByText('This may already be added')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Mark as duplicate' })
    ).toHaveLength(2);
    expect(screen.getByText(/Ion already added this/)).toBeInTheDocument();
  });

  it('renders nothing without candidates or a pending original', () => {
    const { container } = render(
      <DuplicateBanner candidates={[]} onMark={vi.fn()} onKeepBoth={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the pending link with Undo instead of the candidates', async () => {
    const onUndo = vi.fn();
    render(
      <DuplicateBanner
        candidates={[cand('b0')]}
        pendingOriginal={cand('b0')}
        onMark={vi.fn()}
        onKeepBoth={vi.fn()}
        onUndo={onUndo}
      />
    );
    expect(
      screen.getByText("Will be saved as a duplicate of Ana's bill on Oct 3")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Mark as duplicate' })
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
  });

  it('disables the buttons while busy', () => {
    render(
      <DuplicateBanner
        candidates={[cand('b0')]}
        onMark={vi.fn()}
        onKeepBoth={vi.fn()}
        busy
      />
    );
    expect(
      screen.getByRole('button', { name: 'Mark as duplicate' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep both' })).toBeDisabled();
  });
});
