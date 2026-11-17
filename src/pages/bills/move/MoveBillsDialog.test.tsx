import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdTestProvider, TEST_HOUSEHOLDS } from '@/test/household';
import type { Household } from '@/types/households';
import { MoveBillsDialog } from './MoveBillsDialog';

const [, family] = TEST_HOUSEHOLDS as [Household, Household];

function renderDialog(
  onMove: (target: Household) => Promise<void>,
  onOpenChange = vi.fn()
): void {
  render(
    <HouseholdTestProvider>
      <MoveBillsDialog
        open
        onOpenChange={onOpenChange}
        count={2}
        onMove={onMove}
      />
    </HouseholdTestProvider>
  );
}

describe('MoveBillsDialog', () => {
  it('lists budgets except the active one', () => {
    renderDialog(vi.fn());
    expect(
      screen.getByRole('heading', { name: /move 2 bills to/i })
    ).toBeVisible();
    expect(screen.getByRole('radio', { name: /family budget/i })).toBeVisible();
    expect(screen.getByText('MDL')).toBeVisible();
    expect(screen.queryByRole('radio', { name: /personal/i })).toBeNull();
  });

  it('Move is disabled until a budget is picked', async () => {
    renderDialog(vi.fn());
    const submit = screen.getByRole('button', { name: /^move$/i });
    expect(submit).toBeDisabled();
    await userEvent.click(
      screen.getByRole('radio', { name: /family budget/i })
    );
    expect(submit).toBeEnabled();
  });

  it('calls onMove with the picked budget and closes', async () => {
    const onMove = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    renderDialog(onMove, onOpenChange);
    await userEvent.click(
      screen.getByRole('radio', { name: /family budget/i })
    );
    await userEvent.click(screen.getByRole('button', { name: /^move$/i }));
    expect(onMove).toHaveBeenCalledWith(family);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('locks while moving', async () => {
    const onOpenChange = vi.fn();
    renderDialog(() => new Promise(() => undefined), onOpenChange);
    await userEvent.click(
      screen.getByRole('radio', { name: /family budget/i })
    );
    await userEvent.click(screen.getByRole('button', { name: /^move$/i }));
    expect(screen.getByRole('button', { name: /^move$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('a double click sends one move', async () => {
    const onMove = vi.fn(() => new Promise<void>(() => undefined));
    renderDialog(onMove);
    await userEvent.click(
      screen.getByRole('radio', { name: /family budget/i })
    );
    await userEvent.dblClick(screen.getByRole('button', { name: /^move$/i }));
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('closes after a rejected move', async () => {
    const onOpenChange = vi.fn();
    renderDialog(() => Promise.reject(new Error('x')), onOpenChange);
    await userEvent.click(
      screen.getByRole('radio', { name: /family budget/i })
    );
    await userEvent.click(screen.getByRole('button', { name: /^move$/i }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
