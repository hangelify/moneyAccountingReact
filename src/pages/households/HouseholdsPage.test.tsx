import '@/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  HouseholdTestProvider,
  TEST_HOUSEHOLDS,
  makeHouseholdValue,
} from '@/test/household';
import type { Household } from '@/types/households';
import { HouseholdsPage } from './HouseholdsPage';

vi.mock('@/hooks/useHouseholdMutations', () => ({
  useCreateHousehold: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function renderPage(
  overrides: Parameters<typeof makeHouseholdValue>[0] = {}
): ReturnType<typeof makeHouseholdValue> {
  const value = makeHouseholdValue(overrides);
  render(
    <HouseholdTestProvider value={value}>
      <HouseholdsPage />
    </HouseholdTestProvider>
  );
  return value;
}

describe('HouseholdsPage', () => {
  it('lists budgets with currency, role, bill count and active badge', () => {
    renderPage();
    const personal = screen.getByRole('article', { name: /Personal/ });
    expect(within(personal).getByText('Owner')).toBeInTheDocument();
    expect(within(personal).getByText('EUR')).toBeInTheDocument();
    expect(within(personal).getByText('12 bills')).toBeInTheDocument();
    expect(within(personal).getByText('Active')).toBeInTheDocument();
    const family = screen.getByRole('article', { name: /Family Budget/ });
    expect(within(family).getByText('Member')).toBeInTheDocument();
    expect(within(family).getByText('MDL')).toBeInTheDocument();
    expect(within(family).getByText('0 bills')).toBeInTheDocument();
    expect(within(family).queryByText('Active')).not.toBeInTheDocument();
  });

  it('shows the original name when the own name differs', () => {
    const [first, second] = TEST_HOUSEHOLDS as [Household, Household];
    renderPage({
      households: [
        { ...first, name: 'Mine', original_name: 'Personal' },
        second,
      ],
    });
    expect(screen.getByText(/Personal/)).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Mine' })).toBeInTheDocument();
  });

  it('make active switches', async () => {
    const value = renderPage();
    const family = screen.getByRole('article', { name: /Family Budget/ });
    await userEvent.click(
      within(family).getByRole('button', {
        name: 'Make active: Family Budget',
      })
    );
    expect(value.setActiveHouseholdId).toHaveBeenCalledWith('hh-2');
  });

  it('Edit buttons are named after their budget', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: 'Edit Personal' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit Family Budget' })
    ).toBeInTheDocument();
  });

  it('new budget is disabled at the limit', () => {
    const [first] = TEST_HOUSEHOLDS as [Household];
    const five = Array.from({ length: 5 }, (_, i) => ({
      ...first,
      id: `h${String(i)}`,
      name: `B${String(i)}`,
      original_name: `B${String(i)}`,
    }));
    renderPage({ households: five });
    const button = screen.getByRole('button', { name: 'New budget' });
    expect(button).toBeDisabled();
    expect(screen.getByText('You can have up to 5 budgets')).toBeVisible();
    expect(button).toHaveAccessibleDescription('You can have up to 5 budgets');
  });

  it('new budget is enabled below the limit', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'New budget' })).toBeEnabled();
  });

  it('shows loading', () => {
    renderPage({ status: 'loading', households: [], activeHousehold: null });
    expect(screen.queryByText('Budgets')).not.toBeInTheDocument();
  });

  it('shows error with retry', async () => {
    const value = renderPage({
      status: 'error',
      households: [],
      activeHousehold: null,
    });
    expect(
      screen.getByText('Could not load your budgets.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Budgets' })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(value.refetch).toHaveBeenCalled();
  });

  it('shows the empty state with a create button', () => {
    renderPage({ status: 'empty', households: [], activeHousehold: null });
    expect(screen.getByText('You have no budgets')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Budgets' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New budget' })).toBeEnabled();
  });
});
