// src/pages/bills/useDetailOutlet.ts
import { useEffect, useRef, type ReactElement } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useWithActiveHid } from './useWithActiveHid';

export interface DetailOutlet {
  outlet: ReactElement | null;
  // Desktop with a bill open: the list renders only the outlet.
  pageMode: boolean;
  // Opens a bill (with the list's search and budget) so Back can restore
  // the list's place.
  openBill: (id: string) => void;
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

  const navigate = useNavigate();
  const location = useLocation();
  const withActiveHid = useWithActiveHid();
  const openBill = (id: string): void => {
    opened.current = { id, scrollY: window.scrollY };
    void navigate({
      pathname: `./${id}`,
      search: withActiveHid(location.search),
    });
  };

  return { outlet, pageMode, openBill };
}
