import '@/i18n';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/auth/apiError';
import { TEST_HOUSEHOLDS, HouseholdTestProvider } from '@/test/household';
import type { Household } from '@/types/households';
import { HouseholdEditor } from './HouseholdEditor';

const update = vi.fn();
const updateMine = vi.fn();
vi.mock('@/hooks/useUpdateHousehold', () => ({
  useUpdateHousehold: () => ({ mutateAsync: update, isPending: false }),
}));
vi.mock('@/hooks/useHouseholdMutations', () => ({
  useUpdateMyHouseholdName: () => ({
    mutateAsync: updateMine,
    isPending: false,
  }),
  useDeleteHousehold: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const [owner, member] = TEST_HOUSEHOLDS as [Household, Household];

function renderEditor(h: Household = owner): void {
  render(
    <HouseholdTestProvider>
      <HouseholdEditor household={h} />
    </HouseholdTestProvider>
  );
}

const saves = (): HTMLElement[] =>
  screen.getAllByRole('button', { name: 'Save' });
const saveAt = (i: number): HTMLElement => {
  const el = saves()[i];
  if (!el) throw new Error(`no Save button at ${String(i)}`);
  return el;
};
const OWNER_ONLY = 'Only the owner can change name and currency';
const named: Household = { ...owner, name: 'Mine', original_name: 'Personal' };

describe('HouseholdEditor', () => {
  beforeEach(() => {
    update.mockReset().mockResolvedValue({});
    updateMine.mockReset().mockResolvedValue({});
  });

  it('owner form starts from original_name', () => {
    renderEditor(named);
    expect(screen.getByLabelText('Name')).toHaveValue('Personal');
    expect(saves()[0]).toBeDisabled();
  });

  it('owner saves only changed fields', async () => {
    renderEditor(named);
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'MDL');
    await userEvent.click(saveAt(0));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ currency: 'MDL' })
    );
  });

  it('member sees read-only name and currency, no Save, no Delete', () => {
    renderEditor(member);
    expect(screen.getByText(/Family Budget/)).toBeInTheDocument();
    expect(screen.getByText(/MDL/)).toBeInTheDocument();
    expect(screen.getByText(OWNER_ONLY)).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete budget' })).toBeNull();
    // only the own-name Save remains
    expect(saves()).toHaveLength(1);
  });

  it('403 on save switches to read-only', async () => {
    update.mockRejectedValue(new ApiError(403, null, {}, 'Forbidden'));
    renderEditor();
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'MDL');
    await userEvent.click(saveAt(0));
    expect(await screen.findByText(OWNER_ONLY)).toBeInTheDocument();
  });

  it('owner also gets the own name form and delete', () => {
    renderEditor();
    expect(screen.getByLabelText('Your name for this budget')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete budget' })).toBeVisible();
  });

  it('own name: save trims', async () => {
    renderEditor();
    await userEvent.type(
      screen.getByLabelText('Your name for this budget'),
      '  Mine  '
    );
    await userEvent.click(saveAt(1));
    await waitFor(() =>
      expect(updateMine).toHaveBeenCalledWith({ display_name: 'Mine' })
    );
  });

  it('own name: empty is rejected', async () => {
    renderEditor();
    await userEvent.click(saveAt(1));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(updateMine).not.toHaveBeenCalled();
  });

  it('own name: reset sends null, only with an own name', async () => {
    const { unmount } = render(
      <HouseholdTestProvider>
        <HouseholdEditor household={owner} />
      </HouseholdTestProvider>
    );
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    unmount();
    renderEditor(named);
    expect(screen.getByLabelText('Your name for this budget')).toHaveValue(
      'Mine'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() =>
      expect(updateMine).toHaveBeenCalledWith({ display_name: null })
    );
  });
});
