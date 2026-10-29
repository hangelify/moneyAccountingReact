import { useCallback, useSyncExternalStore } from 'react';

const noop = (): void => {
  /* SSR / unsupported */
};

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return noop;
      const mql = window.matchMedia(query);
      mql.addEventListener('change', callback);
      return (): void => mql.removeEventListener('change', callback);
    },
    [query]
  );

  const getSnapshot = useCallback((): boolean => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
