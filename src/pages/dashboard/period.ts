import { addDays, addMonths, addYears, diffDays } from '@/lib/isoDate';
import type {
  SpendingBreakdownParams,
  SpendingPeriod,
} from '@/types/dashboard';

/** A day range; `end` is exclusive, as in the API's `range`. */
export interface DateRange {
  start: string;
  end: string;
}

export type CustomRangeError = 'endBeforeStart' | 'tooLong';

/** Today (or `d`) as `YYYY-MM-DD` from local date parts, never UTC. */
export function localIsoDate(d: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/**
 * The range the backend returns for these params. Used for labels before the
 * first response and for stepping while a newer period is still loading.
 */
export function rangeForParams(p: SpendingBreakdownParams): DateRange {
  if (p.period === 'custom') return { start: p.from, end: addDays(p.to, 1) };
  const a = p.anchor;
  switch (p.period) {
    case 'week': {
      // 1970-01-05 was a Monday; days since then mod 7 gives the weekday.
      const sinceMonday = ((diffDays('1970-01-05', a) % 7) + 7) % 7;
      const start = addDays(a, -sinceMonday);
      return { start, end: addDays(start, 7) };
    }
    case 'month': {
      const start = monthStart(a);
      return { start, end: addMonths(start, 1) };
    }
    case 'quarter': {
      const month = Number(a.slice(5, 7));
      const qMonth = String(month - ((month - 1) % 3)).padStart(2, '0');
      const start = `${a.slice(0, 4)}-${qMonth}-01`;
      return { start, end: addMonths(start, 3) };
    }
    case 'year': {
      const start = `${a.slice(0, 4)}-01-01`;
      return { start, end: addYears(start, 1) };
    }
    case '5y': {
      const end = addMonths(monthStart(a), 1);
      return { start: addMonths(end, -60), end };
    }
  }
}

export function shiftParams(
  p: SpendingBreakdownParams,
  range: DateRange,
  dir: -1 | 1
): SpendingBreakdownParams {
  if (p.period === 'custom') {
    const days = diffDays(p.from, p.to) + 1;
    return {
      period: 'custom',
      from: addDays(p.from, dir * days),
      to: addDays(p.to, dir * days),
    };
  }
  return {
    period: p.period,
    anchor: dir === -1 ? addDays(range.start, -1) : range.end,
  };
}

/** Next is allowed only once the whole range is in the past. */
export function canGoNext(range: DateRange, today = localIsoDate()): boolean {
  return today >= range.end;
}

export function validateCustomRange(
  from: string,
  to: string
): CustomRangeError | null {
  if (to < from) return 'endBeforeStart';
  if (to >= addYears(from, 10)) return 'tooLong';
  return null;
}

const utc = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

export function formatRangeLabel(
  period: SpendingPeriod,
  range: DateRange,
  lang: string
): string {
  const start = utc(range.start);
  switch (period) {
    case 'month':
      return new Intl.DateTimeFormat(lang, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(start);
    case 'quarter':
      return `Q${Math.floor(start.getUTCMonth() / 3) + 1} ${start.getUTCFullYear()}`;
    case 'year':
      return String(start.getUTCFullYear());
    default:
      return new Intl.DateTimeFormat(lang, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).formatRange(start, utc(addDays(range.end, -1)));
  }
}
