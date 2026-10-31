// src/pages/bills/useDetailOutlet.ts
import { useEffect, useRef, type ReactElement } from 'react';
import { useOutlet } from 'react-router-dom';
import { useMediaQuery } from '@/lib/useMediaQuery';

export interface DetailOutlet {
  outlet: ReactElement | null;
  // Desktop with a bill open: the list renders only the outlet.
  pageMode: boolean;
  // Call before opening a bill so Back can restore the list's place.
  rememberOpen: (id: string) => void;
}

// The nested bill detail of a list page. On desktop the detail replaces the
// list, so coming back restores the scroll offset and focuses the opened bill.
export function useDetailOutlet(): DetailOutlet {
  const outlet = useOutlet();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const pageMode = isDesktop && outlet !== null;
  const opened = useRef<{ id: string; scrollY: number } | null>(null);

  useEffect(() => {
    if (pageMode || !opened.current) return;
    const { id, scrollY } = opened.current;
    opened.current = null;
    window.scrollTo(0, scrollY);
    document
      .querySelector<HTMLElement>(`[data-bill-id="${CSS.escape(id)}"]`)
      ?.focus();
  }, [pageMode]);

  const rememberOpen = (id: string): void => {
    opened.current = { id, scrollY: window.scrollY };
  };

  return { outlet, pageMode, rememberOpen };
}
