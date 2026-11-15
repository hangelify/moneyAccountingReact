import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  applyTheme,
  DARK_MEDIA_QUERY,
  readStoredTheme,
  resolveTheme,
  systemPrefersDark,
  writeStoredTheme,
  type Theme,
} from '@/lib/theme';
import { ThemeContext } from './themeContextValue';

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [systemIsDark, setSystemIsDark] = useState(systemPrefersDark);

  // Track the OS only while following it; re-read on entering system mode,
  // since the OS may have changed while an explicit theme was chosen.
  useEffect(() => {
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DARK_MEDIA_QUERY);
    const onChange = (): void => setSystemIsDark(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [theme]);

  const resolvedTheme = resolveTheme(theme, systemIsDark);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme): void => {
    setThemeState(next);
    writeStoredTheme(next);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
