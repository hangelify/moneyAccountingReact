import { CURRENCY, type Currency } from '@/const/currency';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '@/types/pagination';
import type { ConfirmedBillsFilters } from './buildBillsQueryParams';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(v: string | null): string | null {
  if (!v || !ISO_DATE.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = Date.parse(`${v}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  // Reject normalized dates (e.g. "2026-02-31" → "2026-03-03") by
  // round-tripping through a UTC Date and confirming the components match.
  const dt = new Date(t);
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() + 1 !== m ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return v;
}

function parseAmountRange(v: string | null): {
  amount_min: number | null;
  amount_max: number | null;
} {
  if (!v) return { amount_min: null, amount_max: null };
  let min: number | null = null;
  let max: number | null = null;
  for (const tok of v.split(',')) {
    const m = /^gt_(-?\d+(?:\.\d+)?)$/.exec(tok);
    const x = /^lt_(-?\d+(?:\.\d+)?)$/.exec(tok);
    if (m) min = Number(m[1]);
    else if (x) max = Number(x[1]);
  }
  return { amount_min: min, amount_max: max };
}

function parseCurrency(v: string | null): Currency | null {
  if (!v) return null;
  return v in CURRENCY ? (v as Currency) : null;
}

function parsePositiveInt(v: string | null, fallback: number): number {
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

export interface ParsedBillsSearch {
  filters: ConfirmedBillsFilters;
  page: number;
  limit: number;
}

export function parseBillsSearchParams(sp: URLSearchParams): ParsedBillsSearch {
  const namesRaw = sp.getAll('market_names').filter((s) => s.length > 0);
  const market_names = [...new Set(namesRaw)];

  const { amount_min, amount_max } = parseAmountRange(sp.get('amount_range'));

  const filters: ConfirmedBillsFilters = {
    date_from: parseDate(sp.get('date_from')),
    date_to: parseDate(sp.get('date_to')),
    market_names,
    amount_min,
    amount_max,
    currency: parseCurrency(sp.get('currency')),
  };

  const page = parsePositiveInt(sp.get('page'), DEFAULT_PAGE);
  const limit = Math.min(
    MAX_LIMIT,
    parsePositiveInt(sp.get('limit'), DEFAULT_LIMIT)
  );

  return { filters, page, limit };
}
