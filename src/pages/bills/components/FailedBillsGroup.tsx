import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useFailedBills } from '@/hooks/useFailedBills';
import { DEFAULT_LIMIT } from '@/types/pagination';
import { FailedBillCard } from './FailedBillCard';
import { Pagination } from './Pagination';

// Bills the AI could not read, above the drafts. Hidden when there are none.
export function FailedBillsGroup(): ReactElement | null {
  const { t } = useTranslation('bills');
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(true);
  const q = useFailedBills(page, DEFAULT_LIMIT);
  const ref = useRef<HTMLElement>(null);
  const scrolled = useRef(false);

  const total = q.data?.meta.total ?? 0;
  const totalPages = q.data?.meta.total_pages ?? 1;

  // The list shrank below the current page.
  if (q.data && page > totalPages) setPage(Math.max(1, totalPages));

  useEffect(() => {
    if (location.hash === '#failed' && total > 0 && !scrolled.current) {
      scrolled.current = true;
      ref.current?.scrollIntoView();
    }
  }, [location.hash, total]);

  if (!q.data || total === 0) return null;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <section id="failed" ref={ref} className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">
        <button
          type="button"
          className="flex items-center gap-1"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Chevron className="h-4 w-4" aria-hidden="true" />
          {t('failed.title', { count: total })}
        </button>
      </h2>
      {open && (
        <>
          <ul className="flex flex-col gap-2">
            {q.data.data.map((bill) => (
              <FailedBillCard key={bill.id} bill={bill} />
            ))}
          </ul>
          <Pagination meta={q.data.meta} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}
