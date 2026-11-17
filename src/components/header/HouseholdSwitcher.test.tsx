import '@/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { HouseholdTestProvider, makeHouseholdValue } from '@/test/household';
import { HouseholdSwitcher } from './HouseholdSwitcher';
import type { HouseholdContextValue } from '@/contexts/HouseholdContext';

function Where(): React.JSX.Element {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}

function renderSwitcher(
  path = '/dashboard',
  value: HouseholdContextValue = makeHouseholdValue()
): HouseholdContextValue {
  render(
    <HouseholdTestProvider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <HouseholdSwitcher />
        <Where />
      </MemoryRouter>
    </HouseholdTestProvider>
  );
  return value;
}

const open = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: /Budget:/ }));
};

describe('HouseholdSwitcher', () => {
  it('shows the active budget name', () => {
    renderSwitcher();
    expect(
      screen.getByRole('button', { name: 'Budget: Personal' })
    ).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('lists budgets with the active one checked', async () => {
    renderSwitcher();
    await open();
    expect(
      await screen.findByRole('menuitemradio', { name: /Personal/ })
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('menuitemradio', { name: /Family Budget/ })
    ).toHaveAttribute('aria-checked', 'false');
  });

  it('selecting a budget calls setActiveHouseholdId', async () => {
    const value = renderSwitcher();
    await open();
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: /Family Budget/ })
    );
    expect(value.setActiveHouseholdId).toHaveBeenCalledWith('hh-2');
  });

  it('on a bill page goes to its list keeping filters', async () => {
    renderSwitcher('/bills/confirmed/b1?from=2026-01-01&hid=hh-1');
    await open();
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: /Family Budget/ })
    );
    expect(screen.getByTestId('where')).toHaveTextContent(
      '/bills/confirmed?from=2026-01-01'
    );
    expect(screen.getByTestId('where').textContent).not.toContain('hid');
  });

  it('stays on other pages', async () => {
    renderSwitcher('/dashboard');
    await open();
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: /Family Budget/ })
    );
    expect(screen.getByTestId('where')).toHaveTextContent('/dashboard');
  });

  it('Manage budgets links to /households', async () => {
    renderSwitcher();
    await open();
    expect(
      await screen.findByRole('menuitem', { name: 'Manage budgets' })
    ).toHaveAttribute('href', '/households');
  });

  it('renders nothing while loading', () => {
    renderSwitcher(
      '/dashboard',
      makeHouseholdValue({
        status: 'loading',
        households: [],
        activeHousehold: null,
        setActiveHouseholdId: vi.fn(),
      })
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
