import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { UnconvertedBucket } from '@/types/dashboard';
import { formatAmount } from '../format';

/** Bills left out of the converted total, one line per original currency. */
export function UnconvertedNote({
  buckets,
}: {
  buckets: UnconvertedBucket[];
}): ReactElement | null {
  const { t, i18n } = useTranslation('dashboard');
  if (buckets.length === 0) return null;
  return (
    <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
      {buckets.map((b) => (
        <li key={b.currency ?? 'none'}>
          {t(
            b.currency === null
              ? 'unconverted.noCurrency'
              : 'unconverted.currency',
            {
              count: b.bill_count,
              amount: formatAmount(b.amount, b.currency, i18n.language),
            }
          )}
        </li>
      ))}
    </ul>
  );
}
