import '@/i18n';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { mockMatchMedia } from '@/test/matchMedia';
import { UserMenu } from './UserMenu';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'a@b.co', first_name: 'Ann' },
    logout: vi.fn(),
  }),
}));

let restoreMatchMedia: (() => void) | null = null;

afterEach(() => {
  restoreMatchMedia?.();
  restoreMatchMedia = null;
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

function renderMenu(): void {
  restoreMatchMedia = mockMatchMedia(false).restore;
  render(
    <ThemeProvider>
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('UserMenu', () => {
  it('links to household settings', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: 'User menu' }));
    expect(
      await screen.findByRole('menuitem', { name: 'Household settings' })
    ).toHaveAttribute('href', '/households/settings');
  });

  it('switches the theme from the Theme submenu', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: 'User menu' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Theme' })
    );
    expect(
      await screen.findByRole('menuitemradio', { name: 'System' })
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('menuitemradio', { name: 'Light' })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(document.documentElement).toHaveClass('dark');
  });
});
