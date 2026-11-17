import '@/i18n';
import type * as UseToastModule from '@/components/ui/use-toast';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/auth/apiError';
import { toast } from '@/components/ui/use-toast';
import { useCreateHousehold } from '@/hooks/useHouseholdMutations';
import { HouseholdTestProvider, makeHouseholdValue } from '@/test/household';
import { CreateHouseholdDialog } from './CreateHouseholdDialog';

vi.mock('@/hooks/useHouseholdMutations', () => ({
  useCreateHousehold: vi.fn(),
}));
vi.mock('@/components/ui/use-toast', async (importOriginal) => {
  const actual = await importOriginal<typeof UseToastModule>();
  return { ...actual, toast: vi.fn() };
});

const mutateAsync = vi.fn();
const saved = {
  id: 'hh-new',
  name: 'Trip',
  original_name: 'Trip',
  currency: 'EUR',
  created_at: '2026-03-01T00:00:00Z',
  member_count: 1,
};

function renderDialog(): {
  onOpenChange: ReturnType<typeof vi.fn>;
  setActiveHouseholdId: ReturnType<typeof vi.fn>;
} {
  const onOpenChange = vi.fn();
  const value = makeHouseholdValue();
  render(
    <HouseholdTestProvider value={value}>
      <CreateHouseholdDialog
        open
        onOpenChange={onOpenChange}
        defaultCurrency="EUR"
      />
    </HouseholdTestProvider>
  );
  return {
    onOpenChange,
    setActiveHouseholdId: value.setActiveHouseholdId as ReturnType<
      typeof vi.fn
    >,
  };
}

describe('CreateHouseholdDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateHousehold).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateHousehold>);
  });

  it('creates with trimmed name and the active currency', async () => {
    mutateAsync.mockResolvedValue(saved);
    const { onOpenChange } = renderDialog();
    await userEvent.type(screen.getByLabelText('Name'), '  Trip ');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        name: 'Trip',
        currency: 'EUR',
      })
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('requires a name', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('shows the limit message on 409 household_limit', async () => {
    mutateAsync.mockRejectedValue(
      new ApiError(409, { reason: 'household_limit' })
    );
    const { onOpenChange } = renderDialog();
    await userEvent.type(screen.getByLabelText('Name'), 'Trip');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(
      await screen.findByText('You already have 5 budgets')
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('toasts on other errors', async () => {
    mutateAsync.mockRejectedValue(new Error('boom'));
    renderDialog();
    await userEvent.type(screen.getByLabelText('Name'), 'Trip');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't create the budget" })
      )
    );
  });

  it('toast offers switching to the new budget', async () => {
    mutateAsync.mockResolvedValue(saved);
    const { setActiveHouseholdId } = renderDialog();
    await userEvent.type(screen.getByLabelText('Name'), 'Trip');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(toast).toHaveBeenCalled());
    const arg = vi.mocked(toast).mock.calls[0]?.[0];
    expect(arg?.title).toBe('Budget created');
    const action = arg?.action as unknown as React.ReactElement<{
      onClick: () => void;
    }>;
    action.props.onClick();
    expect(setActiveHouseholdId).toHaveBeenCalledWith('hh-new');
  });
});
