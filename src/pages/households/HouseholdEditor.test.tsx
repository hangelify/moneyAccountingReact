import '@/i18n';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as UseToastModule from '@/components/ui/use-toast';
import { ApiError } from '@/auth/apiError';
import { toast } from '@/components/ui/use-toast';
import { TEST_HOUSEHOLDS, HouseholdTestProvider } from '@/test/household';
import type { Household } from '@/types/households';
import { HouseholdEditor } from './HouseholdEditor';

vi.mock('@/components/ui/use-toast', async (importOriginal) => {
  const actual = await importOriginal<typeof UseToastModule>();
  return { ...actual, toast: vi.fn() };
});
const update = vi.fn();
const updateMine = vi.fn();
let minePending = false;
vi.mock('@/hooks/useUpdateHousehold', () => ({
  useUpdateHousehold: () => ({ mutateAsync: update, isPending: false }),
}));
vi.mock('@/hooks/useHouseholdMutations', () => ({
  useUpdateMyHouseholdName: () => ({
    mutateAsync: updateMine,
    isPending: minePending,
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

const save = (): HTMLElement => screen.getByRole('button', { name: 'Save' });
const saveMine = (): HTMLElement =>
  screen.getByRole('button', { name: 'Save my name' });
const OWNER_ONLY = 'Only the owner can change name and currency';
const named: Household = { ...owner, name: 'Mine', original_name: 'Personal' };

describe('HouseholdEditor', () => {
  beforeEach(() => {
    vi.mocked(toast).mockReset();
    update.mockReset().mockResolvedValue({});
    updateMine.mockReset().mockResolvedValue({});
    minePending = false;
  });

  it('owner form starts from original_name', () => {
    renderEditor(named);
    expect(screen.getByLabelText('Name')).toHaveValue('Personal');
    expect(save()).toBeDisabled();
  });

  it('owner saves only changed fields', async () => {
    renderEditor(named);
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'MDL');
    await userEvent.click(save());
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
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(saveMine()).toBeInTheDocument();
  });

  it('403 on save switches to read-only', async () => {
    update.mockRejectedValue(new ApiError(403, null, {}, 'Forbidden'));
    renderEditor();
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'MDL');
    await userEvent.click(save());
    expect(await screen.findByText(OWNER_ONLY)).toBeInTheDocument();
  });

  it('a 400 shows the invalid message and logs', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    update.mockRejectedValue(new ApiError(400, null, {}, 'Bad Request'));
    renderEditor();
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'MDL');
    await userEvent.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't save — check the values"
    );
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('a generic error shows the failure toast', async () => {
    update.mockRejectedValue(new Error('boom'));
    renderEditor();
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'MDL');
    await userEvent.click(save());
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: "Couldn't save the budget",
        })
      )
    );
  });

  it('a successful save shows the saved toast', async () => {
    renderEditor();
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'MDL');
    await userEvent.click(save());
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Budget updated' })
      )
    );
  });

  it('own name: a failure shows a toast', async () => {
    updateMine.mockRejectedValue(new Error('boom'));
    renderEditor(named);
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: "Couldn't save your name",
        })
      )
    );
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
    await userEvent.click(saveMine());
    await waitFor(() =>
      expect(updateMine).toHaveBeenCalledWith({ display_name: 'Mine' })
    );
  });

  it('own name: clearing it is rejected (Reset is the way back)', async () => {
    renderEditor(named);
    await userEvent.clear(screen.getByLabelText('Your name for this budget'));
    await userEvent.click(saveMine());
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(updateMine).not.toHaveBeenCalled();
  });

  it('own name: Save is disabled until the name changes', async () => {
    renderEditor(named);
    expect(saveMine()).toBeDisabled();
    const input = screen.getByLabelText('Your name for this budget');
    await userEvent.type(input, '  ');
    expect(saveMine()).toBeDisabled();
    await userEvent.type(input, 'x');
    expect(saveMine()).toBeEnabled();
  });

  it('own name: shows the pending state while saving', () => {
    minePending = true;
    renderEditor(named);
    const pending = screen.getByRole('button', { name: 'Saving…' });
    expect(pending).toBeDisabled();
    expect(pending.closest('form')).toContainElement(
      screen.getByLabelText('Your name for this budget')
    );
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
