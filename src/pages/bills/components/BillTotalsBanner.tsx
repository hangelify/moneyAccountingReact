import type { ReactElement } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface BillTotalsBannerProps {
  items: { final_price: number }[];
  totalAmount: number;
  currency: string;
}

const TOLERANCE = 0.01;

function formatNumber(n: number): string {
  return n.toFixed(2);
}

function formatSigned(n: number): string {
  return (n > 0 ? '+' : '') + formatNumber(n);
}

export function BillTotalsBanner({
  items,
  totalAmount,
  currency,
}: BillTotalsBannerProps): ReactElement | null {
  const { t } = useTranslation('bills');
  const sum = items.reduce((a, i) => a + i.final_price, 0);
  const diff = sum - totalAmount;
  if (Math.abs(diff) <= TOLERANCE) return null;

  return (
    <div className="flex flex-col gap-1 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 sm:flex-row sm:items-center sm:gap-3">
      <span className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        {t('review.items.totalsMismatch.heading')}
      </span>
      <span>
        {t('review.items.totalsMismatch.itemsSum', {
          value: formatNumber(sum),
          currency,
        })}
      </span>
      <span>
        {t('review.items.totalsMismatch.headerTotal', {
          value: formatNumber(totalAmount),
          currency,
        })}
      </span>
      <span>
        {t('review.items.totalsMismatch.difference', {
          value: formatSigned(diff),
          currency,
        })}
      </span>
    </div>
  );
}
