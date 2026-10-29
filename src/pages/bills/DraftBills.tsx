import type { ReactElement } from 'react';
import { useMemo } from 'react';
import {
  useLocation,
  useNavigate,
  useOutlet,
  useSearchParams,
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useDraftBills } from '@/hooks/useDraftBills';
import { DEFAULT_LIMIT } from '@/types/pagination';
import { parseBillsSearchParams } from './parseBillsSearchParams';
import { BillCardGrid } from './components/BillCardGrid';
import { BillsTabs } from './components/BillsTabs';
import { Pagination } from './components/Pagination';

// Drafts (bills waiting for review). The endpoint takes only page and limit,
// so this tab has no filters.
export function DraftBills(): ReactElement {
  const { t } = useTranslation('bills');
  const navigate = useNavigate();
  const location = useLocation();
  const [sp, setSp] = useSearchParams();
  const page = useMemo(() => parseBillsSearchParams(sp).page, [sp]);
  const q = useDraftBills(page, DEFAULT_LIMIT);

  const setPage = (next: number): void => {
    setSp(next > 1 ? { page: String(next) } : {});
  };

  const openBill = (id: string): void => {
    void navigate({ pathname: `./${id}`, search: location.search });
  };

  // On desktop an open bill is a page of its own, so the list steps aside.
  const outlet = useOutlet();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  if (isDesktop && outlet) return outlet;

  return (
    <>
      <div className="container mx-auto flex flex-col gap-4 px-4 py-6 sm:py-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{t('cards.title')}</h1>
        <BillsTabs />

        {q.isLoading && (
          <p className="text-sm text-muted-foreground">
            {t('confirmed.detail.loading')}
          </p>
        )}

        {q.isError && (
          <div className="flex items-center gap-2">
            <p className="text-sm text-destructive">
              {t('confirmed.table.loadError')}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void q.refetch()}
            >
              {t('confirmed.filters.retry')}
            </Button>
          </div>
        )}

        {q.data?.data.length === 0 && (
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm">{t('drafts.empty')}</p>
          </div>
        )}

        {q.data && q.data.data.length > 0 && (
          <>
            <BillCardGrid bills={q.data.data} onCardClick={openBill} />
            <Pagination meta={q.data.meta} onPageChange={setPage} />
          </>
        )}
      </div>
      {outlet}
    </>
  );
}
