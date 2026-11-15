import { createContext } from 'react';
import type { ResolvedTheme, Theme } from '@/lib/theme';

// Kept apart from ThemeContext.tsx so that file exports only a component
// (react-refresh/only-export-components).
export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
