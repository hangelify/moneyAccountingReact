import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { MoveConflict } from '@/types/bills';
import { movedBillHref, type MoveBillRef, type MoveOutcome } from './types';

export type MoveResultView =
  | { mode: 'losses'; outcome: MoveOutcome }
  | {
      mode: 'conflicts';
      conflicts: MoveConflict[];
      // What was on screen, to name the bills.
      bills: MoveBillRef[];
      onUnselect?: (ids: string[]) => void;
      beforeShowDuplicates?: () => void;
    };

export interface MoveResultDialogProps {
  view: MoveResultView | null;
  onClose: () => void;
  onShowDuplicates: () => void;
}

function BillLabel({ bill }: { bill: MoveBillRef }): ReactElement {
  const { t } = useTranslation('bills');
  return (
    <span className="flex min-w-0 flex-wrap gap-x-2">
      <span className="truncate font-medium">
        {bill.marketName ?? t('cards.noMarket')}
      </span>
      <span className="text-muted-foreground">
        {bill.billDate.slice(0, 10)}
      </span>
      <span className="font-mono">
        {`${bill.total.toFixed(2)} ${bill.currency ?? ''}`.trim()}
      </span>
    </span>
  );
}

function LossesBody({ outcome }: { outcome: MoveOutcome }): ReactElement {
  const { t } = useTranslation('bills');
  return (
    <ul className="flex flex-col gap-2">
      {outcome.withLosses.map((b) => (
        <li
          key={b.id}
          className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
        >
          <span className="flex min-w-0 flex-col gap-1">
            <BillLabel bill={b} />
            <span className="text-muted-foreground">
              {[
                b.lostCategory > 0 &&
                  t('move.result.withoutCategory', { count: b.lostCategory }),
                b.lostSubCategory > 0 &&
                  t('move.result.withoutSubCategory', {
                    count: b.lostSubCategory,
                  }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <Button asChild variant="outline" size="sm">
            <Link to={movedBillHref(b, outcome.target.id)}>
              {t('move.result.open')}
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}

function ConflictsBody({
  conflicts,
  bills,
}: {
  conflicts: MoveConflict[];
  bills: MoveBillRef[];
}): ReactElement {
  const { t } = useTranslation('bills');
  const byId = new Map(bills.map((b) => [b.id, b]));
  return (
    <ul className="flex flex-col gap-2">
      {conflicts.map((c) => {
        const bill = byId.get(c.id);
        return (
          <li
            key={`${c.id}-${c.reason}`}
            className="flex flex-col gap-1 rounded-md border p-3 text-sm"
          >
            {bill && <BillLabel bill={bill} />}
            <span className="text-destructive">
              {t(`move.reason.${c.reason}`)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** What a move did: the bills that lost categories, or why nothing moved. */
export function MoveResultDialog({
  view,
  onClose,
  onShowDuplicates,
}: MoveResultDialogProps): ReactElement {
  const { t } = useTranslation('bills');
  const conflicts = view?.mode === 'conflicts' ? view : null;
  const conflictIds = conflicts
    ? [...new Set(conflicts.conflicts.map((c) => c.id))]
    : [];
  const hasDuplicates =
    conflicts?.conflicts.some((c) => c.reason === 'has_duplicates') ?? false;

  return (
    <Dialog open={view !== null} onOpenChange={(open) => !open && onClose()}>
      {view && (
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {view.mode === 'losses'
                ? t('move.result.movedTo', { name: view.outcome.target.name })
                : t('move.result.nothingMoved')}
            </DialogTitle>
          </DialogHeader>
          {view.mode === 'losses' ? (
            <LossesBody outcome={view.outcome} />
          ) : (
            <ConflictsBody conflicts={view.conflicts} bills={view.bills} />
          )}
          <DialogFooter className="gap-2">
            {conflicts?.onUnselect && (
              <Button
                variant="outline"
                onClick={() => {
                  conflicts.onUnselect?.(conflictIds);
                  onClose();
                }}
              >
                {t('move.result.unselect')}
              </Button>
            )}
            {hasDuplicates && (
              <Button variant="outline" onClick={onShowDuplicates}>
                {t('move.result.showDuplicates')}
              </Button>
            )}
            <Button onClick={onClose}>{t('move.result.done')}</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
