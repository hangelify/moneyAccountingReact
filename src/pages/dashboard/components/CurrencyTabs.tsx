import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface CurrencyTabsProps {
  currencies: (string | null)[];
  selected: string | null;
  onSelect: (currency: string | null) => void;
}

/** One tab per currency; hidden when there is only one. */
export function CurrencyTabs({
  currencies,
  selected,
  onSelect,
}: CurrencyTabsProps): ReactElement | null {
  const { t } = useTranslation('dashboard');
  if (currencies.length < 2) return null;
  return (
    <div
      role="tablist"
      className="inline-flex w-fit gap-1 rounded-lg bg-muted p-1"
    >
      {currencies.map((c) => (
        <button
          key={c ?? 'none'}
          type="button"
          role="tab"
          aria-selected={c === selected}
          className={cn(
            'rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors',
            c === selected && 'bg-background text-foreground shadow-sm'
          )}
          onClick={() => onSelect(c)}
        >
          {c ?? t('noCurrency')}
        </button>
      ))}
    </div>
  );
}
