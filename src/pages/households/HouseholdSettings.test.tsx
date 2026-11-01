import '@/i18n';
import type * as UseToastModule from '@/hooks/use-toast';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '@/auth/apiError';
import { toast } from '@/hooks/use-toast';
import { householdsApi } from '@/pages/households/api';
import {
  HouseholdTestProvider,
  TEST_HOUSEHOLDS,
  makeHouseholdValue,
} from '@/test/household';
import type { Household } from '@/types/households';
import { HouseholdSettings } from './HouseholdSettings';

vi.mock('@/pages/households/api', () => ({
  householdsApi: { update: vi.fn() },
}));
vi.mock('@/hooks/use-toast', async (importOriginal) => {
  const actual = await importOriginal<typeof UseToastModule>();
  return { ...actual, toast: vi.fn() };
});

const update = vi.mocked(householdsApi.update);
const [owner, member] = TEST_HOUSEHOLDS as [Household, Household];

function renderPage(household: Household = owner): {
  handleForbidden: ReturnType<typeof vi.fn>;
} {
  const value = makeHouseholdValue({ activeHousehold: household });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <HouseholdTestProvider value={value}>
        <MemoryRouter>
          <HouseholdSettings />
        </MemoryRouter>
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
  return { handleForbidden: vi.mocked(value.handleForbidden) };
}

const save = (): HTMLElement => screen.getByRole('button', { name: 'Save' });
const OWNER_ONLY = 'Only the household owner can change these.';
const forbidden = (): ApiError =>
  new ApiError(403, null, {}, 'Forbidden', { url: '/households/hh-1' });

describe('HouseholdSettings', () => {
  beforeEach(() => {
    update.mockReset();
    vi.mocked(toast).mockReset();
  });

  it('owner saves a new currency', async () => {
    update.mockResolvedValue({ ...owner, currency: 'MDL' });
    renderPage();
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'MDL');
    await userEvent.click(save());
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('hh-1', { currency: 'MDL' })
    );
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Household updated' })
      )
    );
  });

  it('Save is disabled until something changes', async () => {
    renderPage();
    expect(save()).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Name'), ' ');
    expect(save()).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Name'), 'Home');
    expect(save()).toBeEnabled();
  });

  it('member sees read-only values', () => {
    renderPage(member);
    expect(screen.getByText(OWNER_ONLY)).toBeInTheDocument();
    expect(screen.getByText('Family Budget')).toBeInTheDocument();
    expect(screen.getByText('MDL')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('a 403 switches to read-only', async () => {
    const { role: _omit, ...noRole } = owner;
    update.mockRejectedValue(forbidden());
    const { handleForbidden } = renderPage(noRole);
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'MDL');
    await userEvent.click(save());
    expect(await screen.findByText(OWNER_ONLY)).toBeInTheDocument();
    expect(handleForbidden).not.toHaveBeenCalled();
  });

  it('a 400 shows the invalid message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    update.mockRejectedValue(
      new ApiError(400, null, {}, 'Bad Request', { url: '/households/hh-1' })
    );
    renderPage();
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'MDL');
    await userEvent.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't save — check the values"
    );
  });
});
