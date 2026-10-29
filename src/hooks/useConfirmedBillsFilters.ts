import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  buildBillsQueryParams,
  type ConfirmedBillsFilters,
} from '@/pages/bills/buildBillsQueryParams';
import { parseBillsSearchParams } from '@/pages/bills/parseBillsSearchParams';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/types/pagination';

export interface UseConfirmedBillsFiltersResult {
  filters: ConfirmedBillsFilters;
  page: number;
  limit: number;
  setFilters: (next: ConfirmedBillsFilters) => void;
  setPage: (next: number) => void;
  clearFilters: () => void;
}

const EMPTY: ConfirmedBillsFilters = {
  date_from: null,
  date_to: null,
  market_names: [],
  amount_min: null,
  amount_max: null,
  currency: null,
};

export function useConfirmedBillsFilters(): UseConfirmedBillsFiltersResult {
  const [sp, setSp] = useSearchParams();

  const parsed = useMemo(() => parseBillsSearchParams(sp), [sp]);

  const setFilters = useCallback(
    (next: ConfirmedBillsFilters) => {
      const params = buildBillsQueryParams(next, DEFAULT_PAGE, parsed.limit);
      setSp(toURLSearchParams(params), { replace: true });
    },
    [parsed.limit, setSp]
  );

  const setPage = useCallback(
    (next: number) => {
      const params = buildBillsQueryParams(parsed.filters, next, parsed.limit);
      setSp(toURLSearchParams(params), { replace: false });
    },
    [parsed.filters, parsed.limit, setSp]
  );

  const clearFilters = useCallback(() => {
    const params = buildBillsQueryParams(EMPTY, DEFAULT_PAGE, DEFAULT_LIMIT);
    setSp(toURLSearchParams(params), { replace: true });
  }, [setSp]);

  return {
    filters: parsed.filters,
    page: parsed.page,
    limit: parsed.limit,
    setFilters,
    setPage,
    clearFilters,
  };
}

function toURLSearchParams(
  params: Record<string, string | string[]>
): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => out.append(k, x));
    else out.append(k, v);
  }
  return out;
}
