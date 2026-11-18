/**
 * Calendar periods of category limits, mirroring the server
 * (`src/common/utils/period-range.ts`). Dates are `YYYY-MM-DD` strings,
 * periods are half-open `[start, end)`, and "today" is the UTC date.
 */
export type LimitPeriodType =
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUAL'
  | 'YEARLY';

export const LIMIT_PERIOD_TYPES = [
  'MONTHLY',
  'QUARTERLY',
  'SEMI_ANNUAL',
  'YEARLY',
] as const satisfies readonly LimitPeriodType[];

const MONTHS_IN: Record<LimitPeriodType, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  YEARLY: 12,
};

const pad = (n: number): string => String(n).padStart(2, '0');

/** Month index since year 0 (0-based month) for a `YYYY-MM-DD` date. */
function monthIndex(isoDate: string): number {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  return year * 12 + (month - 1);
}

const firstDayOf = (index: number): string =>
  `${String(Math.floor(index / 12))}-${pad((index % 12) + 1)}-01`;

const startIndex = (type: LimitPeriodType, isoDate: string): number => {
  const index = monthIndex(isoDate);
  return index - ((index % 12) % MONTHS_IN[type]);
};

/** First day of the period of `type` that contains `isoDate`. */
export function limitPeriodStart(
  type: LimitPeriodType,
  isoDate: string
): string {
  return firstDayOf(startIndex(type, isoDate));
}

/** First day of the period after the one that contains `isoDate`. */
export function limitPeriodEnd(type: LimitPeriodType, isoDate: string): string {
  return firstDayOf(startIndex(type, isoDate) + MONTHS_IN[type]);
}

/** Starts of the periods of `type` with `fromIso <= start <= toIso`. */
export function periodStartsBetween(
  type: LimitPeriodType,
  fromIso: string,
  toIso: string
): string[] {
  const out: string[] = [];
  let index = startIndex(type, fromIso);
  if (firstDayOf(index) < fromIso) index += MONTHS_IN[type];
  for (; firstDayOf(index) <= toIso; index += MONTHS_IN[type]) {
    out.push(firstDayOf(index));
  }
  return out;
}

/** Today's date in UTC, as the server computes it. */
export function todayUtcIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
