import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Header } from './Header';

const auth = vi.hoisted(() => ({ isAuthenticated: true }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: auth.isAuthenticated,
    user: { email: 'a@b.co', first_name: 'Ann' },
    logout: vi.fn(),
  }),
}));

// Header's signed-in extras talk to the API; they are not under test here.
vi.mock('@/components/header/BatchBell', () => ({
  BatchBell: (): ReactElement => <div />,
}));
vi.mock('@/components/bills/NewBillModal', () => ({
  NewBillModal: (): null => null,
}));

function renderHeader(): void {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('Header theme switch', () => {
  it('is not shown to signed-in users (they have it in the user menu)', () => {
    auth.isAuthenticated = true;
    renderHeader();
    expect(
      screen.queryByRole('button', { name: 'Change theme' })
    ).not.toBeInTheDocument();
  });

  it('is shown to guests', () => {
    auth.isAuthenticated = false;
    renderHeader();
    expect(
      screen.getByRole('button', { name: 'Change theme' })
    ).toBeInTheDocument();
  });
});
