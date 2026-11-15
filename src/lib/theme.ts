// Theme choice (HAN-106). The inline script in index.html repeats the read
// and apply steps before the bundle loads, so the page never flashes light in
// dark mode — keep the storage key and the logic there in sync with this file.

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

const THEMES: readonly Theme[] = ['light', 'dark', 'system'];

function isTheme(value: string | null): value is Theme {
  return value !== null && (THEMES as readonly string[]).includes(value);
}

// Storage can be unavailable (private mode, blocked site data): fall back to
// following the system.
export function readStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function writeStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The choice still applies for this visit; it just isn't remembered.
  }
}

// jsdom and very old browsers have no matchMedia: treat the system as light.
export function systemPrefersDark(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(DARK_MEDIA_QUERY).matches;
}

export function resolveTheme(
  theme: Theme,
  systemIsDark: boolean
): ResolvedTheme {
  if (theme === 'system') return systemIsDark ? 'dark' : 'light';
  return theme;
}

export function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}
