import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import { DARK_MEDIA_QUERY, THEME_STORAGE_KEY } from './theme';

// The inline script in index.html cannot import lib/theme.ts; this keeps the
// two from drifting apart (a renamed key would bring back the light flash).

describe('index.html theme script', () => {
  it('declares both color schemes', () => {
    expect(indexHtml).toContain(
      '<meta name="color-scheme" content="light dark" />'
    );
  });

  it('reads the same storage key and media query as lib/theme', () => {
    expect(indexHtml).toContain(`'${THEME_STORAGE_KEY}'`);
    expect(indexHtml).toContain(DARK_MEDIA_QUERY);
  });
});
