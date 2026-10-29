import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CURRENCY,
  CURRENCY_REGION_ORDER,
  type Currency,
} from '@/const/currency';

export interface CurrencySelectProps {
  value: Currency | null;
  onChange: (next: Currency | null) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string | undefined;
}

export function CurrencySelect({
  value,
  onChange,
  disabled,
  id,
  'aria-label': ariaLabel,
}: CurrencySelectProps): ReactElement {
  const { t } = useTranslation('bills');

  const handleChange = (v: string): void => {
    if (v === '') return onChange(null);
    if (v in CURRENCY) onChange(v as Currency);
  };

  return (
    <select
      id={id}
      aria-label={ariaLabel}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => handleChange(e.target.value)}
    >
      <option value="">{t('confirmed.filters.currencyAll')}</option>
      {CURRENCY_REGION_ORDER.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.codes.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
