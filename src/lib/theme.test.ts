import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockMatchMedia } from '@/test/matchMedia';
import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  systemPrefersDark,
  writeStoredTheme,
} from './theme';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('readStoredTheme', () => {
  it('returns system when nothing is stored', () => {
    expect(readStoredTheme()).toBe('system');
  });

  it('returns system for an unknown value', () => {
    localStorage.setItem('theme', 'blue');
    expect(readStoredTheme()).toBe('system');
  });

  it('returns the stored theme', () => {
    localStorage.setItem('theme', 'dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('returns system when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readStoredTheme()).toBe('system');
  });
});

describe('writeStoredTheme', () => {
  it('stores the theme under the theme key', () => {
    writeStoredTheme('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('does not throw when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => writeStoredTheme('dark')).not.toThrow();
  });
});

describe('resolveTheme', () => {
  it('follows the system in system mode', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('ignores the system for an explicit choice', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('systemPrefersDark', () => {
  it('is false when matchMedia is missing', () => {
    expect(systemPrefersDark()).toBe(false);
  });

  it('reads the dark color-scheme query', () => {
    const mm = mockMatchMedia(true);
    try {
      expect(systemPrefersDark()).toBe(true);
    } finally {
      mm.restore();
    }
  });
});

describe('applyTheme', () => {
  it('toggles the dark class on <html>', () => {
    applyTheme('dark');
    expect(document.documentElement).toHaveClass('dark');
    applyTheme('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
