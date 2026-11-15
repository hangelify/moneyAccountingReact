import { describe, expect, it } from 'vitest';
import { collectSections, type ShowcaseSection } from './registry';

const Empty = (): null => null;

function make(id: string, title: string, order: number): ShowcaseSection {
  return { id, title, order, Component: Empty };
}

describe('collectSections', () => {
  it('sorts by order, then by title', () => {
    const sections = collectSections({
      './sections/a.tsx': { section: make('a', 'B', 2) },
      './sections/b.tsx': { section: make('b', 'Z', 1) },
      './sections/c.tsx': { section: make('c', 'A', 2) },
    });
    expect(sections.map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('throws on a module without a section', () => {
    expect(() => collectSections({ './sections/typo.tsx': {} })).toThrow(
      './sections/typo.tsx'
    );
  });

  it('throws on a duplicate id', () => {
    expect(() =>
      collectSections({
        './sections/a.tsx': { section: make('button', 'A', 1) },
        './sections/b.tsx': { section: make('button', 'B', 2) },
      })
    ).toThrow('button');
  });
});
