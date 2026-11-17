import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HouseholdAmount } from '@/components/currency/HouseholdAmount';
import type { BillResponseDto, DraftBillDto } from '@/types/bills';
import type { BillSelectionView } from '../move/useBillSelection';
import { SelectMark } from './SelectMark';

// A confirmed summary, or a draft with its receipt fields and items.
export type BillCardBill = BillResponseDto &
  Partial<
    Pick<DraftBillDto, 'market_name_raw' | 'bill_date_inferred' | 'items'>
  >;

export interface BillCardProps {
  bill: BillCardBill;
  onClick: (id: string) => void;
  // Set while bills are being picked: a click toggles instead of opening.
  selection?: BillSelectionView | undefined;
}

const badgeClass =
  'inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive';

export function BillCard({
  bill,
  onClick,
  selection,
}: BillCardProps): ReactElement {
  const { t } = useTranslation('bills');
  const itemsCount = bill.items_count ?? bill.items?.length;
  // Shown only with "Show duplicates"; not counted in any total.
  const isDuplicate = bill.status === 'duplicate';
  const selectable = selection?.isSelectable(bill) ?? false;
  const checked = selectable && (selection?.isSelected(bill.id) ?? false);
  const openLabel = isDuplicate
    ? t('duplicates.openDuplicate')
    : t('cards.open');
  const label = selection ? t('move.selectBill') : openLabel;
  const handleClick = (): void => {
    if (!selection) onClick(bill.id);
    else if (selectable) selection.toggle(bill.id);
  };
  return (
    <button
      type="button"
      aria-label={label}
      {...(selection &&
        (selectable
          ? { role: 'checkbox', 'aria-checked': checked }
          : { 'aria-disabled': true }))}
      data-bill-id={bill.id}
      onClick={handleClick}
      className={cn(
        'flex w-full flex-col gap-3 rounded-lg border bg-card p-4 text-left shadow-sm outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring',
        isDuplicate && 'opacity-60',
        checked && 'ring-2 ring-primary',
        selection && !selectable && 'cursor-default hover:bg-card'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {selectable && <SelectMark checked={checked} />}
        <span className="min-w-0 flex-1 truncate font-medium">
          {bill.market?.name ?? bill.market_name_raw ?? t('cards.noMarket')}
        </span>
        <span className="shrink-0 text-sm text-muted-foreground">
          {bill.bill_date.slice(0, 10)}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-xl font-semibold">
          {bill.total_amount.toFixed(2)}
        </span>
        {bill.currency && (
          <span className="text-sm text-muted-foreground">{bill.currency}</span>
        )}
      </div>
      <HouseholdAmount bill={bill} className="-mt-2 text-sm" />
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {itemsCount != null && (
          <span>{t('cards.itemsCount', { count: itemsCount })}</span>
        )}
        {isDuplicate && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Copy className="h-3 w-3" aria-hidden />
            {t('duplicates.badge')}
          </span>
        )}
        {bill.amount_mismatch && (
          <span className={badgeClass}>
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {t('cards.mismatch')}
          </span>
        )}
        {bill.bill_date_inferred && (
          <span className={badgeClass}>
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {t('cards.dateInferred')}
          </span>
        )}
      </div>
    </button>
  );
}
