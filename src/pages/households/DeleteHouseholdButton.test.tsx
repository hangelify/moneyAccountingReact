import '@/i18n';
import type * as UseToastModule from '@/components/ui/use-toast';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/auth/apiError';
import { toast } from '@/components/ui/use-toast';
import {
  HouseholdTestProvider,
  TEST_HOUSEHOLDS,
  makeHouseholdValue,
} from '@/test/household';
import type { Household } from '@/types/households';
import { DeleteHouseholdButton } from './DeleteHouseholdButton';

const remove = vi.fn();
vi.mock('@/hooks/useHouseholdMutations', () => ({
  useDeleteHousehold: () => ({ mutateAsync: remove, isPending: false }),
}));
vi.mock('@/components/ui/use-toast', async (importOriginal) => {
  const actual = await importOriginal<typeof UseToastModule>();
  return { ...actual, toast: vi.fn() };
});

const [owner] = TEST_HOUSEHOLDS as [Household];
const conflict = (reason: string): ApiError =>
  new ApiError(409, { reason }, {}, 'Conflict');

function renderButton(h: Household = owner, list = TEST_HOUSEHOLDS): void {
  render(
    <HouseholdTestProvider value={makeHouseholdValue({ households: list })}>
      <DeleteHouseholdButton household={h} />
    </HouseholdTestProvider>
  );
}

const open = (): Promise<void> =>
  userEvent.click(screen.getByRole('button', { name: 'Delete budget' }));
const confirm = (): Promise<void> =>
  userEvent.click(screen.getByRole('button', { name: 'Delete' }));

describe('DeleteHouseholdButton', () => {
  beforeEach(() => {
    remove.mockReset().mockResolvedValue(undefined);
    vi.mocked(toast).mockReset();
  });

  it('confirmation mentions the bill count', async () => {
    renderButton();
    await open();
    expect(screen.getByText('Delete “Personal”?')).toBeInTheDocument();
    expect(
      screen.getByText("It has 12 bills. This can't be undone.")
    ).toBeInTheDocument();
  });

  it('omits it at zero', async () => {
    renderButton({ ...owner, bill_count: 0 });
    await open();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
  });

  it.each([
    ['only budget', owner, [owner], "You can't delete your only budget"],
    [
      'other members',
      { ...owner, member_count: 3 },
      TEST_HOUSEHOLDS,
      'Remove other members first',
    ],
  ])('disabled for %s, with a hint', async (_n, h, list, hint) => {
    renderButton(h, list);
    const button = screen.getByRole('button', { name: 'Delete budget' });
    expect(button).toBeDisabled();
    const wrapper = button.parentElement;
    if (!wrapper) throw new Error('no wrapper');
    await userEvent.hover(wrapper);
    expect(await screen.findByRole('tooltip', { name: hint })).toBeVisible();
  });

  it.each([
    [
      new ApiError(403, null, {}, 'Forbidden'),
      'Only the owner can delete this budget',
    ],
    [new Error('boom'), "Couldn't delete the budget"],
  ])('%# shows its failure text', async (error, text) => {
    remove.mockRejectedValue(error);
    renderButton();
    await open();
    await confirm();
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', title: text })
      )
    );
  });
  it.each([
    ['last_household', "You can't delete your only budget"],
    ['household_has_members', 'Remove other members first'],
  ])('409 %s shows its text', async (reason, text) => {
    remove.mockRejectedValue(conflict(reason));
    renderButton();
    await open();
    await confirm();
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', title: text })
      )
    );
  });

  it('deleting calls the mutation with the hid and only toasts success', async () => {
    renderButton();
    await open();
    await confirm();
    await waitFor(() => expect(remove).toHaveBeenCalledWith('hh-1'));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Budget deleted' })
      )
    );
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });
});
