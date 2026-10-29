import { MAX_LIMIT } from '@/types/pagination';
import type { Currency } from '@/const/currency';

export interface ConfirmedBillsFilters {
  date_from: string | null;
  date_to: string | null;
  market_names: string[];
  amount_min: number | null;
  amount_max: number | null;
  currency: Currency | null;
}

export type BillsQueryParams = Record<string, string | string[]>;

export function buildBillsQueryParams(
  filters: ConfirmedBillsFilters,
  page: number,
  limit: number
): BillsQueryParams {
  const out: BillsQueryParams = {};

  if (filters.date_from) out.date_from = filters.date_from;
  if (filters.date_to) out.date_to = filters.date_to;

  if (filters.market_names.length > 0) {
    out.market_names = [...filters.market_names];
  }

  const tokens: string[] = [];
  if (filters.amount_min != null) tokens.push(`gt_${filters.amount_min}`);
  if (filters.amount_max != null) tokens.push(`lt_${filters.amount_max}`);
  if (tokens.length > 0) out.amount_range = tokens.join(',');

  if (filters.currency) out.currency = filters.currency;

  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit) || 1));
  out.page = String(safePage);
  out.limit = String(safeLimit);

  return out;
}
