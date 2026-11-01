import '@/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UserMenu } from './UserMenu';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'a@b.co', first_name: 'Ann' },
    logout: vi.fn(),
  }),
}));

describe('UserMenu', () => {
  it('links to household settings', async () => {
    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: 'User menu' }));
    expect(
      await screen.findByRole('menuitem', { name: 'Household settings' })
    ).toHaveAttribute('href', '/households/settings');
  });
});
