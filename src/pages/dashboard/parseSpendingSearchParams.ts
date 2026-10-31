import { SPENDING_PERIODS } from '@/const/dashboard';
import { parseIsoDate } from '@/lib/isoDate';
import type {
  SpendingBreakdownParams,
  SpendingPeriod,
} from '@/types/dashboard';
import { localIsoDate, validateCustomRange } from './period';

export interface ParsedSpendingSearch {
  params: SpendingBreakdownParams;
  /** The URL held params that were rejected; the caller rewrites it. */
  invalid: boolean;
}

function isPeriod(v: string): v is SpendingPeriod {
  return (SPENDING_PERIODS as readonly string[]).includes(v);
}

export function parseSpendingSearchParams(
  sp: URLSearchParams,
  today = localIsoDate()
): ParsedSpendingSearch {
  const fallback = (invalid: boolean): ParsedSpendingSearch => ({
    params: { period: 'month', anchor: today },
    invalid,
  });

  const period = sp.get('period');
  if (period === null) return fallback(sp.size > 0);
  if (!isPeriod(period)) return fallback(true);

  if (period === 'custom') {
    const from = parseIsoDate(sp.get('from'));
    const to = parseIsoDate(sp.get('to'));
    if (!from || !to || validateCustomRange(from, to)) return fallback(true);
    return { params: { period, from, to }, invalid: false };
  }

  const rawAnchor = sp.get('anchor');
  if (rawAnchor === null) {
    return { params: { period, anchor: today }, invalid: false };
  }
  const anchor = parseIsoDate(rawAnchor);
  if (!anchor) return fallback(true);
  return { params: { period, anchor }, invalid: false };
}

export function toSpendingSearchParams(
  p: SpendingBreakdownParams
): URLSearchParams {
  return new URLSearchParams(
    p.period === 'custom'
      ? { period: p.period, from: p.from, to: p.to }
      : { period: p.period, anchor: p.anchor }
  );
}
