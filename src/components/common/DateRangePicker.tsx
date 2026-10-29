import type { ReactElement } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface DateRangePickerProps {
  from: string | null;
  to: string | null;
  onChange: (next: { from: string | null; to: string | null }) => void;
  disabled?: boolean;
}

export function DateRangePicker({
  from,
  to,
  onChange,
  disabled,
}: DateRangePickerProps): ReactElement {
  const { t } = useTranslation('bills');
  const fromId = useId();
  const toId = useId();
  const invalid = !!from && !!to && to < from;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor={fromId}>{t('confirmed.filters.dateFrom')}</Label>
          <Input
            id={fromId}
            type="date"
            value={from ?? ''}
            onChange={(e) => onChange({ from: e.target.value || null, to })}
            disabled={disabled}
            aria-invalid={invalid}
          />
        </div>
        <div className="flex-1">
          <Label htmlFor={toId}>{t('confirmed.filters.dateTo')}</Label>
          <Input
            id={toId}
            type="date"
            value={to ?? ''}
            onChange={(e) => onChange({ from, to: e.target.value || null })}
            disabled={disabled}
            aria-invalid={invalid}
          />
        </div>
      </div>
      {invalid && (
        <p className="text-sm text-destructive">
          {t('confirmed.filters.dateInvalid')}
        </p>
      )}
    </div>
  );
}
