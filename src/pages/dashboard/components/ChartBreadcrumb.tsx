import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { formatAmount } from '../format';
import { swatchStyle, type SegmentLook } from './segmentStyle';

export interface ChartBreadcrumbZoom {
  name: string;
  look: SegmentLook;
  total: number;
  share: number;
}

export interface ChartBreadcrumbProps {
  currency: string | null;
  /** The currency's total, shown at the top level. */
  total: number;
  zoomed: ChartBreadcrumbZoom | null;
  onBack: () => void;
}

/**
 * Always-present title row for the chart: "All categories" at the top level,
 * "All categories › Food" while zoomed, with the visible total on the right.
 * The row keeps its height either way, so zooming never moves the chart;
 * on mobile the total always sits on its own line for the same reason.
 */
export function ChartBreadcrumb({
  currency,
  total,
  zoomed,
  onBack,
}: ChartBreadcrumbProps): ReactElement {
  const { t, i18n } = useTranslation('dashboard');
  const money = (n: number): string => formatAmount(n, currency, i18n.language);

  return (
    <nav
      aria-label={t('breadcrumb')}
      className="flex min-h-9 flex-col gap-0.5 md:flex-row md:items-center md:justify-between md:gap-4"
    >
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {zoomed ? (
          <>
            <li className="shrink-0">
              <button
                type="button"
                className="rounded-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={onBack}
              >
                {t('allCategories')}
              </button>
            </li>
            <li aria-hidden className="shrink-0 text-muted-foreground">
              <ChevronRight className="h-4 w-4" />
            </li>
            <li
              aria-current="page"
              className="flex min-w-0 items-center gap-2 font-medium"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={swatchStyle(zoomed.look)}
                aria-hidden
              />
              <span className="truncate">{zoomed.name}</span>
            </li>
          </>
        ) : (
          <li aria-current="page" className="font-medium">
            {t('allCategories')}
          </li>
        )}
      </ol>
      <p className="text-sm tabular-nums text-muted-foreground">
        <span className="font-medium text-foreground">
          {money(zoomed ? zoomed.total : total)}
        </span>
        {zoomed && <> · {zoomed.share.toFixed(2)}%</>}
      </p>
    </nav>
  );
}
