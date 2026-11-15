import type { ReactElement } from 'react';
import { ThemeToggle } from '@/components/header/ThemeToggle';
import { sections } from './registry';
import { ThemePreview } from './ThemePreview';

// Dev-only page (HAN-107): every UI component and color token, in a light
// and a dark column. App.tsx mounts it only when import.meta.env.DEV.
export function DevUiPage(): ReactElement {
  return (
    <div className="container mx-auto space-y-8 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">UI showcase</h1>
        <ThemeToggle />
      </header>

      <nav aria-label="Sections">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-primary hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {sections.map(({ id, title, Component }) => (
        <section
          key={id}
          id={id}
          aria-labelledby={`${id}-title`}
          className="scroll-mt-20 space-y-3"
        >
          <h2 id={`${id}-title`} className="text-xl font-semibold">
            {title}
          </h2>
          <ThemePreview>
            <Component />
          </ThemePreview>
        </section>
      ))}
    </div>
  );
}
