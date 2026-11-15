import type { ComponentType } from 'react';

// One showcase section (HAN-107). Each file in ./sections exports
// `section`; the page picks them up on its own, so adding a component to the
// showcase never touches a shared file.
export interface ShowcaseSection {
  id: string;
  title: string;
  order: number;
  Component: ComponentType;
}

type SectionModules = Record<string, { section?: ShowcaseSection }>;

export function collectSections(modules: SectionModules): ShowcaseSection[] {
  const seen = new Set<string>();
  const sections = Object.entries(modules).map(([path, module]) => {
    const { section } = module;
    if (!section) {
      throw new Error(`${path} must export \`section\``);
    }
    if (seen.has(section.id)) {
      throw new Error(`Duplicate showcase section id "${section.id}"`);
    }
    seen.add(section.id);
    return section;
  });
  return sections.sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title)
  );
}

export const sections: ShowcaseSection[] = collectSections(
  import.meta.glob<{ section?: ShowcaseSection }>('./sections/*.tsx', {
    eager: true,
  })
);
