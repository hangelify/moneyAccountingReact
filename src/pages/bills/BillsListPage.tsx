import type { ReactElement, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ConfirmedBillsFilters } from './components/ConfirmedBillsFilters';
import { Pagination } from './components/Pagination';
import { useDetailOutlet } from './useDetailOutlet';
import { useConfirmedBillsFilters } from '@/hooks/useConfirmedBillsFilters';
import { useConfirmedBills } from '@/hooks/useConfirmedBills';
import {
  useActiveHouseholdId,
  useHouseholds,
} from '@/contexts/HouseholdContext';
import { buildBillsQueryParams } from '@/api/buildBillsQueryParams';
import type { BillResponseDto } from '@/types/bills';
import type { Household } from '@/types/households';
import { MoveBillsDialog } from './move/MoveBillsDialog';
import { MoveResultProvider, useMoveResult } from './move/MoveResultProvider';
import { SelectionBar } from './move/SelectionBar';
import { MoveError, toMoveBillRef } from './move/types';
import {
  isMovableBill,
  useBillSelection,
  type BillSelectionView,
} from './move/useBillSelection';
import { useMoveBills } from './move/useMoveBills';

export interface BillsListPageProps {
  title: string;
  // The list's own route, where "Show duplicates" leads.
  listPath: '/bills' | '/bills/confirmed';
  // Shown between the title and the filters (e.g. tabs).
  header?: ReactNode;
  // Replaces the default "no bills yet" state when nothing is filtered.
  emptyNoBills?: ReactNode;
  // Renders the current page of bills; openBill opens the nested detail route.
  // `selection` is set only while bills are being picked.
  renderBills: (
    bills: BillResponseDto[],
    openBill: (id: string) => void,
    selection?: BillSelectionView
  ) => ReactElement;
}

// Shared shell for the confirmed-bills list views: filters, loading, error,
// empty state, pagination, picking bills to move and the nested detail
// <Outlet />.
export function BillsListPage(props: BillsListPageProps): ReactElement {
  const { filters, limit } = useConfirmedBillsFilters();
  const duplicatesParams = new URLSearchParams();
  for (const [k, v] of Object.entries(
    buildBillsQueryParams({ ...filters, include_duplicates: true }, 1, limit)
  )) {
    if (k === 'page') continue;
    for (const x of Array.isArray(v) ? v : [v]) duplicatesParams.append(k, x);
  }
  return (
    <MoveResultProvider
      showDuplicatesHref={`${props.listPath}?${duplicatesParams.toString()}`}
    >
      <BillsListPageBody {...props} />
    </MoveResultProvider>
  );
}

function BillsListPageBody({
  title,
  header,
  emptyNoBills,
  renderBills,
}: BillsListPageProps): ReactElement {
  const { t } = useTranslation('bills');
  const { filters, page, limit, setFilters, setPage, clearFilters } =
    useConfirmedBillsFilters();
  const q = useConfirmedBills(filters, page, limit);
  const hid = useActiveHouseholdId();
  const { households } = useHouseholds();
  const selection = useBillSelection(
    [hid ?? '', String(page), JSON.stringify(filters)].join('|')
  );
  const mover = useMoveBills();
  const report = useMoveResult();
  const [moveOpen, setMoveOpen] = useState(false);

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

  const { outlet, pageMode, openBill } = useDetailOutlet();

  const bills = q.data?.data ?? [];
  const movable = bills.filter(isMovableBill);
  const canSelect = households.length > 1 && movable.length > 0;
  const pickedCount = movable.filter((b) =>
    selection.selected.has(b.id)
  ).length;
  const allState: boolean | 'mixed' =
    pickedCount === 0 ? false : pickedCount === movable.length || 'mixed';

  const toggleAll = (): void =>
    selection.setMany(
      movable.map((b) => b.id),
      allState !== true
    );

  const moveSelected = async (target: Household): Promise<void> => {
    const refs = movable
      .filter((b) => selection.selected.has(b.id))
      .map(toMoveBillRef);
    try {
      report.reportSuccess(await mover.move(refs, target));
      selection.cancel();
    } catch (err) {
      if (!(err instanceof MoveError)) throw err;
      report.reportFailure(err.failure, {
        bills: refs,
        onUnselect: selection.unselect,
      });
      if (err.failure.kind === 'missing') selection.cancel();
    }
  };

  const selectionView: BillSelectionView | undefined = selection.selecting
    ? {
        isSelected: (id) => selection.selected.has(id),
        toggle: selection.toggle,
        isSelectable: isMovableBill,
      }
    : undefined;

  // On desktop an open bill is a page of its own, so the list steps aside.
  if (pageMode && outlet) return outlet;

  return (
    <>
      <div className="container mx-auto flex flex-col gap-4 px-4 py-6 sm:py-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {header}

        <ConfirmedBillsFilters
          value={filters}
          onChange={setFilters}
          onClear={clearFilters}
        />

        {canSelect && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={selection.selecting ? selection.cancel : selection.start}
            >
              {selection.selecting ? t('move.cancel') : t('move.select')}
            </Button>
          </div>
        )}

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

        {q.data?.data.length === 0 && !hasActiveFilters && emptyNoBills}

        {q.data?.data.length === 0 && (hasActiveFilters || !emptyNoBills) && (
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
            {renderBills(q.data.data, openBill, selectionView)}
            <Pagination meta={q.data.meta} onPageChange={setPage} />
          </>
        )}

        {selection.selecting && canSelect && (
          <SelectionBar
            count={pickedCount}
            allState={allState}
            onToggleAll={toggleAll}
            onMove={() => setMoveOpen(true)}
            disabled={mover.isPending}
          />
        )}
        <MoveBillsDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          count={pickedCount}
          onMove={moveSelected}
        />
      </div>
      {outlet}
    </>
  );
}
