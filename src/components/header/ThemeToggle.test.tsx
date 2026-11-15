import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { mockMatchMedia } from '@/test/matchMedia';
import { ThemeToggle } from './ThemeToggle';

let restoreMatchMedia: (() => void) | null = null;

afterEach(() => {
  restoreMatchMedia?.();
  restoreMatchMedia = null;
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('ThemeToggle', () => {
  it('offers three themes and applies the picked one', async () => {
    restoreMatchMedia = mockMatchMedia(false).restore;
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Change theme' }));
    expect(
      await screen.findByRole('menuitemradio', { name: 'Light' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', { name: 'System' })
    ).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(document.documentElement).toHaveClass('dark');
  });
});
