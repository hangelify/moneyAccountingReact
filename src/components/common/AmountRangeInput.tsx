import type { ReactElement } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface AmountRangeInputProps {
  min: number | null;
  max: number | null;
  onChange: (next: { min: number | null; max: number | null }) => void;
  disabled?: boolean;
}

function toNum(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function AmountRangeInput({
  min,
  max,
  onChange,
  disabled,
}: AmountRangeInputProps): ReactElement {
  const { t } = useTranslation('bills');
  const minId = useId();
  const maxId = useId();
  const invalid = min != null && max != null && min > max;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor={minId}>{t('confirmed.filters.amountMin')}</Label>
          <Input
            id={minId}
            type="number"
            inputMode="decimal"
            value={min ?? ''}
            onChange={(e) => onChange({ min: toNum(e.target.value), max })}
            disabled={disabled}
            aria-invalid={invalid}
          />
        </div>
        <div className="flex-1">
          <Label htmlFor={maxId}>{t('confirmed.filters.amountMax')}</Label>
          <Input
            id={maxId}
            type="number"
            inputMode="decimal"
            value={max ?? ''}
            onChange={(e) => onChange({ min, max: toNum(e.target.value) })}
            disabled={disabled}
            aria-invalid={invalid}
          />
        </div>
      </div>
      {invalid && (
        <p className="text-sm text-destructive">
          {t('confirmed.filters.amountInvalid')}
        </p>
      )}
    </div>
  );
}
