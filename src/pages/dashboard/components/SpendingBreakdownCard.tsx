import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ApiError } from '@/auth/apiError';
import { isHouseholdForbidden } from '@/auth/isHouseholdForbidden';
import { Button } from '@/components/ui/button';
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { useSpendingBreakdown } from '@/hooks/useSpendingBreakdown';
import { cn } from '@/lib/utils';
import type {
  SpendingBreakdown,
  SpendingBreakdownParams,
  SpendingCurrency,
} from '@/types/dashboard';
import {
  parseSpendingSearchParams,
  parseZoomCategory,
  toSpendingSearchParams,
} from '../parseSpendingSearchParams';
import { formatRangeLabel, rangeForParams } from '../period';
import { PALETTE_SIZE, categoryKey } from '../sunburstGeometry';
import { CurrencyTabs } from './CurrencyTabs';
import { PeriodPicker } from './PeriodPicker';
import { SpendingLegend } from './SpendingLegend';
import { SpendingSunburst } from './SpendingSunburst';
import { ChartBreadcrumb } from './ChartBreadcrumb';

/** The currency with the most spending; the first one on ties. */
function largest(list: SpendingCurrency[]): SpendingCurrency | undefined {
  return list.reduce<SpendingCurrency | undefined>(
    (best, c) => (best === undefined || c.total > best.total ? c : best),
    undefined
  );
}

export function SpendingBreakdownCard(): ReactElement {
  const { t, i18n } = useTranslation('dashboard');
  const hid = useActiveHouseholdId();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.toString();
  const { params, invalid } = useMemo(
    () => parseSpendingSearchParams(new URLSearchParams(search)),
    [search]
  );
  const category = parseZoomCategory(searchParams);

  useEffect(() => {
    if (invalid) {
      setSearchParams(toSpendingSearchParams(params), { replace: true });
    }
  }, [invalid, params, setSearchParams]);

  const setParams = useCallback(
    (p: SpendingBreakdownParams) => setSearchParams(toSpendingSearchParams(p)),
    [setSearchParams]
  );

  const query = useSpendingBreakdown(params);

  // Keep the last good answer so a failed refetch doesn't blank the chart,
  // but never show one household's answer under another.
  const [lastGood, setLastGood] = useState<{
    hid: string | null;
    data: SpendingBreakdown;
  }>();
  if (query.data && query.data !== lastGood?.data) {
    setLastGood({ hid, data: query.data });
  }
  const data =
    query.data ??
    (query.isError && lastGood?.hid === hid ? lastGood.data : undefined);
  const stale =
    query.isPlaceholderData || (query.isError && data !== undefined);

  // While a newer period loads, the response's range is the old one; step
  // and label from the requested params instead.
  const range =
    query.data && !query.isPlaceholderData
      ? query.data.range
      : rangeForParams(params);
  const label = formatRangeLabel(params.period, range, i18n.language);

  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 400) {
      // The picker validates before sending, so a 400 is a bug.
      console.error('spending-breakdown rejected params', params, query.error);
    }
  }, [query.error, params]);

  const currencies = data?.by_currency ?? [];
  const [picked, setPicked] = useState<string | null | undefined>();
  const current =
    currencies.find((c) => c.currency === picked) ?? largest(currencies);

  // The zoom lives in the URL, so Back (browser or phone gesture) zooms out.
  // A period change writes params without it, which drops the zoom.
  const zoomedIndex =
    category === null || !current
      ? -1
      : current.categories.findIndex((c) => categoryKey(c) === category);
  const zoomed = current?.categories[zoomedIndex];
  const zoomedKey = zoomed ? category : null;
  const onZoom = useCallback(
    (key: string | null) =>
      setSearchParams(toSpendingSearchParams(params, key)),
    [params, setSearchParams]
  );

  // A category that isn't in this period's (or currency's) answer is dropped.
  const settled = query.data !== undefined && !query.isPlaceholderData;
  useEffect(() => {
    if (category !== null && settled && !zoomed) {
      setSearchParams(toSpendingSearchParams(params), { replace: true });
    }
  }, [category, settled, zoomed, params, setSearchParams]);

  // Highlight belongs to one view; any URL or currency change drops it.
  const scope = `${search}|${current?.currency ?? ''}`;
  const [highlight, setHighlight] = useState<{
    scope: string;
    key: string | null;
  }>({ scope, key: null });
  const highlightedKey = highlight.scope === scope ? highlight.key : null;
  const onHighlight = useCallback(
    (key: string | null) => setHighlight({ scope, key }),
    [scope]
  );

  const forbidden = isHouseholdForbidden(query.error);
  const retry = (): void => {
    void query.refetch();
  };

  let body: ReactElement | null;
  if (forbidden) {
    // The household provider sends the user to the picker.
    body = null;
  } else if (hid === null || (query.isPending && !data)) {
    body = <Skeleton />;
  } else if (!data) {
    body = (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-muted-foreground">{t('error')}</p>
        <Button type="button" variant="outline" onClick={retry}>
          {t('retry')}
        </Button>
      </div>
    );
  } else if (!current) {
    body = (
      <p className="py-10 text-center text-muted-foreground">{t('empty')}</p>
    );
  } else {
    body = (
      <div className="relative flex flex-col gap-4">
        {query.isError && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
            <span>{t('error')}</span>
            <Button type="button" size="sm" variant="outline" onClick={retry}>
              {t('retry')}
            </Button>
          </div>
        )}
        <CurrencyTabs
          currencies={currencies.map((c) => c.currency)}
          selected={current.currency}
          onSelect={setPicked}
        />
        <div className="flex flex-col gap-3">
          <ChartBreadcrumb
            currency={current.currency}
            total={current.total}
            zoomed={
              zoomed
                ? {
                    name: zoomed.id === null ? t('uncategorized') : zoomed.name,
                    look: {
                      colorIndex: zoomedIndex % PALETTE_SIZE,
                      tint: 0,
                      muted: zoomed.archived,
                      uncategorized: zoomed.id === null,
                    },
                    total: zoomed.total,
                    share: zoomed.share,
                  }
                : null
            }
            onBack={() => onZoom(null)}
          />
          <div
            className={cn(
              'flex flex-col items-center gap-6 transition-opacity md:flex-row md:items-center',
              stale && 'opacity-60'
            )}
          >
            <div className="w-full md:w-1/2">
              <SpendingSunburst
                data={current}
                centreLabel={label}
                zoomedKey={zoomedKey}
                onZoom={onZoom}
                highlightedKey={highlightedKey}
                onHighlight={onHighlight}
              />
            </div>
            <div className="w-full md:w-1/2">
              <SpendingLegend
                data={current}
                zoomedKey={zoomedKey}
                highlightedKey={highlightedKey}
                onZoom={onZoom}
              />
            </div>
          </div>
        </div>
        {query.isFetching && query.isPlaceholderData && (
          <Loader2
            className="absolute right-0 top-0 h-4 w-4 animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <PeriodPicker
        params={params}
        range={range}
        label={label}
        onChange={setParams}
      />
      {/* Controls above the line, data below it. */}
      {body && <div className="border-t pt-5">{body}</div>}
    </section>
  );
}

function Skeleton(): ReactElement {
  return (
    <div
      className="flex animate-pulse flex-col items-center gap-6 md:flex-row"
      aria-busy="true"
    >
      <div className="aspect-square w-full max-w-[22rem] rounded-full border-[2.5rem] border-muted md:w-1/2" />
      <div className="w-full space-y-3 md:w-1/2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-5 rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
