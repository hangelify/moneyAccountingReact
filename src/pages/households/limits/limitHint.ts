import {
  limitPeriodStart,
  periodStartsBetween,
  type LimitPeriodType,
} from '@/lib/limitPeriods';
import type { CategoryLimit } from '@/types/categoryLimits';

export interface LimitHint {
  /** First day the new limit applies (the server writes the same). */
  start: string;
  /** Periods of the old type that are left without a limit, if any. */
  lostPeriods: { type: LimitPeriodType; starts: string[] } | null;
}

/**
 * What saving `newType` today does: from which period it applies and, when an
 * open limit changes type and the new period starts earlier than the old
 * one's current period, which periods of the old type end up without a limit.
 */
export function limitHint(
  newType: LimitPeriodType,
  current: CategoryLimit | null,
  today: string
): LimitHint {
  const start = limitPeriodStart(newType, today);
  // No open limit (none, or ending) or the same type: nothing is lost.
  if (current?.effective_to !== null || current.period_type === newType) {
    return { start, lostPeriods: null };
  }
  const oldType = current.period_type;
  const oldCurrent = limitPeriodStart(oldType, today);
  if (start >= oldCurrent) return { start, lostPeriods: null };
  return {
    start,
    lostPeriods: {
      type: oldType,
      starts: periodStartsBetween(oldType, start, oldCurrent),
    },
  };
}

/** "November 2026", "Q4 2026", "H2 2026" or "2026". */
export function formatPeriod(
  type: LimitPeriodType,
  isoStart: string,
  lang: string
): string {
  const year = isoStart.slice(0, 4);
  const month = Number(isoStart.slice(5, 7));
  switch (type) {
    case 'MONTHLY':
      return new Intl.DateTimeFormat(lang, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${isoStart}T00:00:00Z`));
    case 'QUARTERLY':
      return `Q${String(Math.floor((month - 1) / 3) + 1)} ${year}`;
    case 'SEMI_ANNUAL':
      return `H${month < 7 ? '1' : '2'} ${year}`;
    case 'YEARLY':
      return year;
  }
}
