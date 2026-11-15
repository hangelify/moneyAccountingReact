import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { mockMatchMedia } from '@/test/matchMedia';
import { DevUiPage } from './DevUiPage';
import { sections } from './registry';

let restoreMatchMedia: (() => void) | null = null;

afterEach(() => {
  restoreMatchMedia?.();
  restoreMatchMedia = null;
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('DevUiPage', () => {
  // A new section adds its id here; arrayContaining keeps parallel PRs from
  // conflicting over one exact list.
  it('includes the built-in sections', () => {
    expect(sections.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        'colors',
        'button',
        'input',
        'select',
        'decimal-input',
        'date-range-picker',
        'dialog',
        'sheet',
        'dropdown-menu',
        'tooltip',
        'toast',
        'confirm-dialog',
        'table',
        'segmented-tabs',
      ])
    );
  });

  it.each([
    ['light', false],
    ['dark', true],
  ])('renders every section in both columns (%s page)', (_, osDark) => {
    restoreMatchMedia = mockMatchMedia(osDark).restore;
    const { container } = render(
      <ThemeProvider>
        <DevUiPage />
      </ThemeProvider>
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'UI showcase' })
    ).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(osDark);
    for (const section of sections) {
      expect(
        screen.getByRole('heading', { level: 2, name: section.title })
      ).toBeInTheDocument();
    }
    expect(
      container.querySelectorAll('[data-theme-preview="light"]')
    ).toHaveLength(sections.length);
    expect(
      container.querySelectorAll('[data-theme-preview="dark"]')
    ).toHaveLength(sections.length);

    // Each section renders twice: ids must still be unique for labels/ARIA.
    const ids = [...container.querySelectorAll('[id]')].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
