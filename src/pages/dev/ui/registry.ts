import type { ComponentType } from 'react';

// Showcase sections (HAN-107). Each file in ./sections exports `id`, `title`,
// `order` (literal constants) and a `Section` component; the page picks them
// up on its own, so adding a component to the showcase touches no shared file.
// Literal constants keep react-refresh/only-export-components happy.
export interface SectionModule {
  id?: string;
  title?: string;
  order?: number;
  Section?: ComponentType;
}

export interface ShowcaseSection {
  id: string;
  title: string;
  order: number;
  Component: ComponentType;
}

export function collectSections(
  modules: Record<string, SectionModule>
): ShowcaseSection[] {
  const seen = new Set<string>();
  const sections = Object.entries(modules).map(([path, m]) => {
    const { id, title, order, Section } = m;
    if (
      id === undefined ||
      title === undefined ||
      order === undefined ||
      !Section
    ) {
      throw new Error(
        `${path} must export id, title, order and a Section component`
      );
    }
    if (seen.has(id)) {
      throw new Error(`Duplicate showcase section id "${id}"`);
    }
    seen.add(id);
    return { id, title, order, Component: Section };
  });
  return sections.sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title)
  );
}

export const sections: ShowcaseSection[] = collectSections(
  import.meta.glob<SectionModule>('./sections/*.tsx', { eager: true })
);
