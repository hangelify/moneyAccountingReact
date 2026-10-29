import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ConfirmedBillsFilters } from './components/ConfirmedBillsFilters';
import { ConfirmedBillsTable } from './components/ConfirmedBillsTable';
import { Pagination } from './components/Pagination';
import { useConfirmedBillsFilters } from '@/hooks/useConfirmedBillsFilters';
import { useConfirmedBills } from '@/hooks/useConfirmedBills';

export function ConfirmedBills(): ReactElement {
  const { t } = useTranslation('bills');
  const navigate = useNavigate();
  const location = useLocation();
  const { filters, page, limit, setFilters, setPage, clearFilters } =
    useConfirmedBillsFilters();
  const q = useConfirmedBills(filters, page, limit);

  // If filters shrink the result set so page > total_pages, snap back to 1 once.
  const snappedRef = useRef(false);
  useEffect(() => {
    if (!q.data) return;
    if (
      !snappedRef.current &&
      q.data.meta.total > 0 &&
      page > q.data.meta.total_pages
    ) {
      snappedRef.current = true;
      setPage(1);
    } else if (page <= q.data.meta.total_pages) {
      snappedRef.current = false;
    }
  }, [q.data, page, setPage]);

  const hasActiveFilters =
    !!filters.date_from ||
    !!filters.date_to ||
    !!filters.currency ||
    filters.market_names.length > 0 ||
    filters.amount_min != null ||
    filters.amount_max != null;

  return (
    <>
      <div className="container mx-auto flex flex-col gap-4 px-4 py-6 sm:py-8">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {t('confirmed.title')}
        </h1>

        <ConfirmedBillsFilters
          value={filters}
          onChange={setFilters}
          onClear={clearFilters}
        />

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

        {q.data && q.data.data.length === 0 && (
          <div className="flex flex-col items-start gap-3 rounded-lg border bg-card p-6">
            <p className="text-sm">
              {hasActiveFilters
                ? t('confirmed.empty.noMatches')
                : t('confirmed.empty.noBills')}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                {t('confirmed.empty.clear')}
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/">{t('confirmed.empty.newBill')}</Link>
              </Button>
            )}
          </div>
        )}

        {q.data && q.data.data.length > 0 && (
          <>
            <ConfirmedBillsTable
              bills={q.data.data}
              onRowClick={(id) => {
                void navigate({
                  pathname: `./${id}`,
                  search: location.search,
                });
              }}
            />
            <Pagination meta={q.data.meta} onPageChange={setPage} />
          </>
        )}
      </div>
      <Outlet />
    </>
  );
}
