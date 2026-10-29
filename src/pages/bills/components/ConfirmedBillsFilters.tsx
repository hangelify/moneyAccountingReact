import type { ReactElement } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { AmountRangeInput } from '@/components/common/AmountRangeInput';
import { CurrencySelect } from '@/components/currency/CurrencySelect';
import { MarketMultiSelect } from '@/components/markets/MarketMultiSelect';
import type { ConfirmedBillsFilters as Filters } from '@/pages/bills/buildBillsQueryParams';

export interface ConfirmedBillsFiltersProps {
  value: Filters;
  onChange: (next: Filters) => void;
  onClear: () => void;
}

export function ConfirmedBillsFilters({
  value,
  onChange,
  onClear,
}: ConfirmedBillsFiltersProps): ReactElement {
  const { t } = useTranslation('bills');
  const currencyId = useId();
  const marketsId = useId();

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:p-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <DateRangePicker
          from={value.date_from}
          to={value.date_to}
          onChange={({ from, to }) =>
            onChange({ ...value, date_from: from, date_to: to })
          }
        />
        <AmountRangeInput
          min={value.amount_min}
          max={value.amount_max}
          onChange={({ min, max }) =>
            onChange({ ...value, amount_min: min, amount_max: max })
          }
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor={marketsId}>{t('confirmed.filters.markets')}</Label>
          <MarketMultiSelect
            id={marketsId}
            aria-label={t('confirmed.filters.markets')}
            value={value.market_names}
            onChange={(market_names) => onChange({ ...value, market_names })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={currencyId}>{t('confirmed.filters.currency')}</Label>
          <CurrencySelect
            id={currencyId}
            aria-label={t('confirmed.filters.currency')}
            value={value.currency}
            onChange={(currency) => onChange({ ...value, currency })}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClear}>
          {t('confirmed.filters.clear')}
        </Button>
      </div>
    </div>
  );
}
