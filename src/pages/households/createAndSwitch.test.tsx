import '@/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HouseholdProvider, useHouseholds } from '@/contexts/HouseholdContext';
import { householdsApi } from '@/api/households';
import { Toaster } from '@/components/ui/toaster';
import { TEST_HOUSEHOLDS } from '@/test/household';
import type { Household } from '@/types/households';
import { useState, type ReactElement } from 'react';
import { CreateHouseholdDialog } from './CreateHouseholdDialog';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));
vi.mock('@/api/households', () => ({
  householdsApi: { list: vi.fn(), create: vi.fn() },
}));

const list = vi.mocked(householdsApi.list);
const create = vi.mocked(householdsApi.create);

const saved = {
  id: 'hh-new',
  name: 'Trip',
  original_name: 'Trip',
  currency: 'EUR',
  created_at: '2026-03-01T00:00:00Z',
  member_count: 1,
};
const created: Household = { ...saved, role: 'owner', bill_count: 0 };

function ActiveProbe(): ReactElement {
  const { activeHousehold } = useHouseholds();
  return <p data-testid="active">{activeHousehold?.id ?? 'none'}</p>;
}

/** Closes on success like the page does, so the toast is not aria-hidden. */
function Dialog(): ReactElement {
  const [open, setOpen] = useState(true);
  return (
    <CreateHouseholdDialog
      open={open}
      onOpenChange={setOpen}
      defaultCurrency="EUR"
    />
  );
}

function renderApp(): QueryClient {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <HouseholdProvider>
        <ActiveProbe />
        <Dialog />
        <Toaster />
      </HouseholdProvider>
    </QueryClientProvider>
  );
  return qc;
}

async function createTrip(): Promise<void> {
  await waitFor(() =>
    expect(screen.getByTestId('active')).toHaveTextContent('hh-1')
  );
  await userEvent.type(screen.getByLabelText('Name'), 'Trip');
  await userEvent.click(screen.getByRole('button', { name: 'Create' }));
}

describe('create a budget, then "Switch to it"', () => {
  let resolveRefetch: ((value: Household[]) => void) | undefined;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('activeHouseholdId', 'hh-1');
    create.mockReset().mockResolvedValue(saved);
    list
      .mockReset()
      .mockResolvedValueOnce(TEST_HOUSEHOLDS)
      .mockImplementationOnce(
        () =>
          new Promise<Household[]>((resolve) => {
            resolveRefetch = resolve;
          })
      );
  });

  it('switches while the list refetch is still pending', async () => {
    renderApp();
    await createTrip();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Switch to it' })
    );
    await waitFor(() =>
      expect(screen.getByTestId('active')).toHaveTextContent('hh-new')
    );
    expect(localStorage.getItem('activeHouseholdId')).toBe('hh-new');
  });

  it('switches after the list refetch has returned', async () => {
    const qc = renderApp();
    await createTrip();
    const switchButton = await screen.findByRole('button', {
      name: 'Switch to it',
    });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    resolveRefetch?.([...TEST_HOUSEHOLDS, created]);
    await waitFor(() => expect(qc.isFetching()).toBe(0));
    await userEvent.click(switchButton);
    await waitFor(() =>
      expect(screen.getByTestId('active')).toHaveTextContent('hh-new')
    );
    expect(localStorage.getItem('activeHouseholdId')).toBe('hh-new');
  });
});
