import '@/i18n';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HouseholdProvider } from '@/contexts/HouseholdContext';
import { householdsApi } from '@/api/households';
import { TEST_HOUSEHOLDS } from '@/test/household';
import { HouseholdsPage } from './HouseholdsPage';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));
vi.mock('@/api/households', () => ({
  householdsApi: { list: vi.fn(), remove: vi.fn() },
}));

describe('deleting a budget on the Budgets page', () => {
  it('moves focus to the page heading, not <body>', async () => {
    vi.mocked(householdsApi.list).mockResolvedValue(TEST_HOUSEHOLDS);
    vi.mocked(householdsApi.remove).mockResolvedValue(undefined);
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <HouseholdProvider>
          <HouseholdsPage />
        </HouseholdProvider>
      </QueryClientProvider>
    );

    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Personal' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete budget' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(screen.queryByRole('article', { name: 'Personal' })).toBeNull()
    );
    const heading = screen.getByRole('heading', { level: 1, name: 'Budgets' });
    await waitFor(() => expect(heading).toHaveFocus());
  });
});
