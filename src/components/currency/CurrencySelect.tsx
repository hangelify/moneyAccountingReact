import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/select';
import {
  CURRENCY,
  CURRENCY_REGION_ORDER,
  type Currency,
} from '@/const/currency';

export interface CurrencySelectProps {
  value: Currency | null;
  onChange: (next: Currency | null) => void;
  disabled?: boolean;
  // A value must be picked: no "All currencies" option.
  required?: boolean;
  // Text of the empty option; "All currencies" by default.
  emptyLabel?: string;
  id?: string;
  'aria-label'?: string | undefined;
}

export function CurrencySelect({
  value,
  onChange,
  disabled,
  required = false,
  emptyLabel,
  id,
  'aria-label': ariaLabel,
}: CurrencySelectProps): ReactElement {
  const { t } = useTranslation('bills');

  const handleChange = (v: string): void => {
    if (v === '') {
      onChange(null);
      return;
    }
    if (v in CURRENCY) onChange(v);
  };

  return (
    <Select
      id={id}
      aria-label={ariaLabel}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => handleChange(e.target.value)}
    >
      {!required && (
        <option value="">
          {emptyLabel ?? t('confirmed.filters.currencyAll')}
        </option>
      )}
      {CURRENCY_REGION_ORDER.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.codes.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
