import type { ReactElement, ReactNode } from 'react';

const THEMES = [
  { theme: 'light', label: 'Light' },
  { theme: 'dark', label: 'Dark' },
] as const;

// The same content in a forced light and a forced dark column. `.light`
// re-declares the light tokens (index.css), so it holds inside a dark page.
export function ThemePreview({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {THEMES.map(({ theme, label }) => (
        <div
          key={theme}
          data-theme-preview={theme}
          className={`${theme} min-w-0 rounded-lg border bg-background p-4 text-foreground`}
        >
          <p className="mb-3 text-xs text-muted-foreground">{label}</p>
          {children}
        </div>
      ))}
    </div>
  );
}
