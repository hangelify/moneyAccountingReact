import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { mockMatchMedia } from '@/test/matchMedia';
import { ThemeProvider } from './ThemeContext';
import { useTheme } from './useTheme';

function Probe(): ReactElement {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme('light')}>light</button>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('system')}>system</button>
    </div>
  );
}

function renderProbe(): void {
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>
  );
}

const html = document.documentElement;
let restoreMatchMedia: (() => void) | null = null;

afterEach(() => {
  restoreMatchMedia?.();
  restoreMatchMedia = null;
  vi.restoreAllMocks();
  localStorage.clear();
  html.classList.remove('dark');
});

function withSystem(dark: boolean): (next: boolean) => void {
  const mm = mockMatchMedia(dark);
  restoreMatchMedia = mm.restore;
  return mm.setMatches;
}

describe('ThemeProvider', () => {
  it('follows a light system by default', () => {
    withSystem(false);
    renderProbe();
    expect(screen.getByTestId('theme')).toHaveTextContent('system');
    expect(html).not.toHaveClass('dark');
  });

  it('applies the stored theme on mount', () => {
    withSystem(false);
    localStorage.setItem('theme', 'dark');
    renderProbe();
    expect(html).toHaveClass('dark');
  });

  it('switches and remembers the chosen theme', async () => {
    withSystem(false);
    renderProbe();
    await userEvent.click(screen.getByRole('button', { name: 'dark' }));
    expect(html).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('follows an OS theme change live in system mode', () => {
    const setSystemDark = withSystem(false);
    renderProbe();
    act(() => setSystemDark(true));
    expect(html).toHaveClass('dark');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
  });

  it('ignores the OS while a theme is chosen explicitly', async () => {
    const setSystemDark = withSystem(false);
    renderProbe();
    await userEvent.click(screen.getByRole('button', { name: 'light' }));
    act(() => setSystemDark(true));
    expect(html).not.toHaveClass('dark');
    await userEvent.click(screen.getByRole('button', { name: 'system' }));
    expect(html).toHaveClass('dark');
  });

  it('renders light when matchMedia is missing', () => {
    renderProbe();
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
  });

  it('still applies the theme when storage cannot be written', async () => {
    withSystem(false);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    renderProbe();
    await userEvent.click(screen.getByRole('button', { name: 'dark' }));
    expect(html).toHaveClass('dark');
  });

  it('useTheme throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(
      'useTheme must be used within a ThemeProvider'
    );
  });
});
