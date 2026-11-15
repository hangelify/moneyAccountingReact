import { describe, expect, it } from 'vitest';
import { collectSections, type SectionModule } from './registry';

const Empty = (): null => null;

function make(id: string, title: string, order: number): SectionModule {
  return { id, title, order, Section: Empty };
}

describe('collectSections', () => {
  it('sorts by order, then by title', () => {
    const sections = collectSections({
      './sections/a.tsx': make('a', 'B', 2),
      './sections/b.tsx': make('b', 'Z', 1),
      './sections/c.tsx': make('c', 'A', 2),
    });
    expect(sections.map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('keeps the component of each section', () => {
    const [section] = collectSections({
      './sections/a.tsx': make('a', 'A', 1),
    });
    expect(section?.Component).toBe(Empty);
  });

  it('throws on a module missing an export, naming the file', () => {
    expect(() =>
      collectSections({ './sections/typo.tsx': { id: 'typo', title: 'T' } })
    ).toThrow('./sections/typo.tsx');
  });

  it('throws on a duplicate id', () => {
    expect(() =>
      collectSections({
        './sections/a.tsx': make('button', 'A', 1),
        './sections/b.tsx': make('button', 'B', 2),
      })
    ).toThrow('button');
  });
});
