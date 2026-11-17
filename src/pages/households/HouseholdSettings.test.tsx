import '@/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseholdTestProvider, makeHouseholdValue } from '@/test/household';
import { HouseholdSettings } from './HouseholdSettings';

vi.mock('./HouseholdEditor', () => ({
  HouseholdEditor: ({ household }: { household: { name: string } }) => (
    <div>editor for {household.name}</div>
  ),
}));

function renderPage(
  overrides: Parameters<typeof makeHouseholdValue>[0] = {}
): ReturnType<typeof makeHouseholdValue> {
  const value = makeHouseholdValue(overrides);
  render(
    <HouseholdTestProvider value={value}>
      <HouseholdSettings />
    </HouseholdTestProvider>
  );
  return value;
}

describe('HouseholdSettings', () => {
  it('renders the editor for the active budget', () => {
    renderPage();
    expect(screen.getByText('Budget settings')).toBeInTheDocument();
    expect(screen.getByText('editor for Personal')).toBeInTheDocument();
  });

  it('shows nothing but a loader while loading', () => {
    renderPage({ status: 'loading', activeHousehold: null });
    expect(screen.queryByText('Budget settings')).not.toBeInTheDocument();
  });

  it('shows a retry when there is no active budget', async () => {
    const value = renderPage({ status: 'error', activeHousehold: null });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(value.refetch).toHaveBeenCalled();
  });
});
