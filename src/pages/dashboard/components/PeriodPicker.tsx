import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { SPENDING_PERIODS } from '@/const/dashboard';
import { addDays } from '@/lib/isoDate';
import type {
  SpendingBreakdownParams,
  SpendingPeriod,
} from '@/types/dashboard';
import {
  canGoNext,
  localIsoDate,
  shiftParams,
  validateCustomRange,
  type DateRange,
} from '../period';

const CUSTOM_DEBOUNCE_MS = 400;

export interface PeriodPickerProps {
  params: SpendingBreakdownParams;
  range: DateRange;
  label: string;
  onChange: (p: SpendingBreakdownParams) => void;
}

export function PeriodPicker({
  params,
  range,
  label,
  onChange,
}: PeriodPickerProps): ReactElement {
  const { t } = useTranslation('dashboard');

  const pick = (period: SpendingPeriod): void => {
    if (period === params.period) return;
    if (period === 'custom') {
      onChange({ period, from: range.start, to: addDays(range.end, -1) });
    } else {
      const anchor = params.period === 'custom' ? params.from : localIsoDate();
      onChange({ period, anchor });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SPENDING_PERIODS.map((p) => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant={p === params.period ? 'default' : 'outline'}
            aria-pressed={p === params.period}
            className="shrink-0"
            onClick={() => pick(p)}
          >
            {t(`period.${p}`)}
          </Button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={t('previous')}
          onClick={() => onChange(shiftParams(params, range, -1))}
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-0 truncate text-center font-medium">
          {label}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={t('next')}
          disabled={!canGoNext(range)}
          onClick={() => onChange(shiftParams(params, range, 1))}
        >
          <ChevronRight />
        </Button>
      </div>

      {params.period === 'custom' && (
        // Remount on outside changes (prev/next) so the draft follows them.
        <CustomRange
          key={`${params.from}|${params.to}`}
          from={params.from}
          to={params.to}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function CustomRange({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (p: SpendingBreakdownParams) => void;
}): ReactElement {
  const { t } = useTranslation('dashboard');
  const [draft, setDraft] = useState({ from, to });
  const error =
    draft.from && draft.to ? validateCustomRange(draft.from, draft.to) : null;

  useEffect(() => {
    if (!draft.from || !draft.to || error) return;
    if (draft.from === from && draft.to === to) return;
    const id = setTimeout(() => {
      onChange({ period: 'custom', from: draft.from, to: draft.to });
    }, CUSTOM_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [draft, error, from, to, onChange]);

  return (
    <div className="flex flex-col gap-1">
      <DateRangePicker
        from={draft.from || null}
        to={draft.to || null}
        onChange={(next) =>
          setDraft({ from: next.from ?? '', to: next.to ?? '' })
        }
      />
      {/* DateRangePicker already reports an end before the start. */}
      {error === 'tooLong' && (
        <p className="text-sm text-destructive">{t('customErrors.tooLong')}</p>
      )}
    </div>
  );
}
