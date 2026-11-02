import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { SPENDING_PERIODS } from '@/const/dashboard';
import { addDays } from '@/lib/isoDate';
import { cn } from '@/lib/utils';
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
      {/* One toolbar on desktop: range type on the left, range value on the
          right. On mobile it wraps into two rows. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Mobile: a segmented control that fits all six options. Desktop:
            separate outline buttons. */}
        <div className="grid grid-cols-6 rounded-lg bg-muted p-1 md:flex md:gap-2 md:bg-transparent md:p-0">
          {SPENDING_PERIODS.map((p) => {
            const selected = p === params.period;
            return (
              <button
                key={p}
                type="button"
                aria-pressed={selected}
                className={cn(
                  'inline-flex items-center justify-center whitespace-nowrap rounded-md py-1.5 text-[11px] font-medium min-[360px]:text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  'md:h-8 md:border md:px-3 md:py-0 md:text-sm md:shadow-sm',
                  selected
                    ? 'bg-background text-foreground shadow-sm md:border-primary md:bg-primary md:text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground md:border-input md:bg-background md:text-foreground md:hover:bg-accent'
                )}
                onClick={() => pick(p)}
              >
                {t(`period.${p}`)}
              </button>
            );
          })}
        </div>

        {/* The arrows hug a fixed-width label so they stay put while the
            label changes length. Full width on mobile, under the periods. */}
        <div className="flex w-full items-center rounded-md border md:inline-flex md:w-auto md:shrink-0 md:self-center">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-r-none md:h-9 md:w-9"
            aria-label={t('previous')}
            onClick={() => onChange(shiftParams(params, range, -1))}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-0 flex-1 truncate whitespace-nowrap border-x px-3 text-center text-sm font-medium tabular-nums leading-10 md:min-w-[11rem] md:flex-none md:leading-9">
            {label}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-l-none md:h-9 md:w-9"
            aria-label={t('next')}
            disabled={!canGoNext(range)}
            onClick={() => onChange(shiftParams(params, range, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      {params.period === 'custom' && (
        <CustomRange from={params.from} to={params.to} onChange={onChange} />
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
  // Follow outside changes (prev/next, back button) without remounting, so
  // the focused input survives our own debounced commits.
  const [synced, setSynced] = useState({ from, to });
  if (synced.from !== from || synced.to !== to) {
    setSynced({ from, to });
    if (draft.from !== from || draft.to !== to) setDraft({ from, to });
  }
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
