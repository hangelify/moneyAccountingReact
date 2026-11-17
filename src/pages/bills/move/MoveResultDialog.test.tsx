import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TEST_HOUSEHOLDS } from '@/test/household';
import type { MoveConflict } from '@/types/bills';
import type { Household } from '@/types/households';
import { MoveResultDialog, type MoveResultView } from './MoveResultDialog';
import type { MoveBillRef, MovedBillInfo, MoveOutcome } from './types';

const [, family] = TEST_HOUSEHOLDS as [Household, Household];

const bill = (id: string, over: Partial<MoveBillRef> = {}): MoveBillRef => ({
  id,
  status: 'confirmed',
  marketName: `Shop ${id}`,
  billDate: '2026-11-01T00:00:00Z',
  total: 12.5,
  currency: 'EUR',
  ...over,
});

const movedInfo = (
  id: string,
  lostCategory: number,
  lostSubCategory: number,
  over: Partial<MoveBillRef> = {}
): MovedBillInfo => ({
  ...bill(id, over),
  lostCategory,
  lostSubCategory,
  alreadyMoved: false,
});

function renderView(
  view: MoveResultView,
  onShowDuplicates: () => void = vi.fn()
): void {
  render(
    <MemoryRouter>
      <MoveResultDialog
        view={view}
        onClose={vi.fn()}
        onShowDuplicates={onShowDuplicates}
      />
    </MemoryRouter>
  );
}

const conflictsView = (
  conflicts: MoveConflict[],
  over: Partial<Extract<MoveResultView, { mode: 'conflicts' }>> = {}
): MoveResultView => ({
  mode: 'conflicts',
  conflicts,
  bills: [bill('a'), bill('b')],
  ...over,
});

describe('MoveResultDialog', () => {
  it('losses lists bills with both counts and links', () => {
    const withLosses = [
      movedInfo('b1', 2, 0, { status: 'draft' }),
      movedInfo('b2', 1, 3),
    ];
    const outcome: MoveOutcome = {
      target: family,
      moved: withLosses,
      lostLines: 3,
      lostSubLines: 3,
      withLosses,
    };
    renderView({ mode: 'losses', outcome });

    expect(
      screen.getByRole('heading', { name: /moved to “family budget”/i })
    ).toBeVisible();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const [first, second] = items as [HTMLElement, HTMLElement];
    expect(within(first).getByText('Shop b1')).toBeVisible();
    expect(within(first).getByText(/2 without category/i)).toBeVisible();
    expect(within(first).queryByText(/without subcategory/i)).toBeNull();
    expect(within(first).getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      '/bills/drafts/b1?hid=hh-2'
    );
    expect(within(second).getByText(/3 without subcategory/i)).toBeVisible();
    expect(within(second).getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      '/bills/b2?hid=hh-2'
    );
  });

  it('conflicts shows a text per reason', () => {
    renderView(
      conflictsView(
        [
          { id: 'a', reason: 'status_not_movable' },
          { id: 'a', reason: 'has_duplicates' },
          { id: 'b', reason: 'draft_image_conflict' },
          { id: 'b', reason: 'client_batch_conflict' },
          { id: 'b', reason: 'unknown' },
        ],
        { bills: [bill('a'), bill('b')] }
      )
    );
    expect(
      screen.getByRole('heading', { name: /nothing was moved/i })
    ).toBeVisible();
    expect(
      screen.getByText(/duplicates and unreadable receipts/i)
    ).toBeVisible();
    expect(screen.getByText(/unmark them first/i)).toBeVisible();
    expect(
      screen.getByText(/already has a draft of this photo/i)
    ).toBeVisible();
    expect(screen.getAllByText(/can't be moved to that budget/i)).toHaveLength(
      2
    );
  });

  it('a conflict for a bill not on screen shows only the reason', () => {
    renderView(
      conflictsView([{ id: 'zzz', reason: 'unknown' }], { bills: [] })
    );
    const [item] = screen.getAllByRole('listitem') as [HTMLElement];
    expect(within(item).getByText(/can't be moved/i)).toBeVisible();
    expect(within(item).queryByText(/shop/i)).toBeNull();
  });

  it('Unselect these passes conflict ids', async () => {
    const onUnselect = vi.fn();
    renderView(
      conflictsView(
        [
          { id: 'a', reason: 'has_duplicates' },
          { id: 'a', reason: 'status_not_movable' },
        ],
        { onUnselect }
      )
    );
    await userEvent.click(
      screen.getByRole('button', { name: /unselect these/i })
    );
    expect(onUnselect).toHaveBeenCalledWith(['a']);
  });

  it('has no Unselect without onUnselect', () => {
    renderView(conflictsView([{ id: 'a', reason: 'has_duplicates' }]));
    expect(screen.queryByRole('button', { name: /unselect/i })).toBeNull();
  });

  it('Show duplicates only with has_duplicates', () => {
    const onShowDuplicates = vi.fn();
    renderView(
      conflictsView([{ id: 'a', reason: 'draft_image_conflict' }]),
      onShowDuplicates
    );
    expect(
      screen.queryByRole('button', { name: /show duplicates/i })
    ).toBeNull();
  });

  it('Show duplicates calls back', async () => {
    const onShowDuplicates = vi.fn();
    renderView(
      conflictsView([{ id: 'a', reason: 'has_duplicates' }]),
      onShowDuplicates
    );
    await userEvent.click(
      screen.getByRole('button', { name: /show duplicates/i })
    );
    expect(onShowDuplicates).toHaveBeenCalled();
  });
});
