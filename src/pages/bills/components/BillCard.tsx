import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import type { BillResponseDto } from '@/types/bills';

export interface BillCardProps {
  bill: BillResponseDto;
  onClick: (id: string) => void;
}

export function BillCard({ bill, onClick }: BillCardProps): ReactElement {
  const { t } = useTranslation('bills');
  return (
    <button
      type="button"
      aria-label={t('cards.open')}
      onClick={() => onClick(bill.id)}
      className="flex w-full flex-col gap-3 rounded-lg border bg-card p-4 text-left shadow-sm outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate font-medium">
          {bill.market?.name ?? t('cards.noMarket')}
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
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {bill.items_count != null && (
          <span>{t('cards.itemsCount', { count: bill.items_count })}</span>
        )}
        {bill.amount_mismatch && (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {t('cards.mismatch')}
          </span>
        )}
      </div>
    </button>
  );
}
