import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { SpendingCurrency } from '@/types/dashboard';
import { formatAmount } from '../format';
import { PALETTE_SIZE, categoryKey } from '../sunburstGeometry';
import { swatchStyle, type SegmentLook } from './segmentStyle';

export interface SpendingLegendProps {
  data: SpendingCurrency;
  zoomedKey: string | null;
  highlightedKey: string | null;
  onZoom: (key: string) => void;
}

interface Row {
  key: string;
  name: string;
  total: number;
  share: number;
  look: SegmentLook;
  zoomable: boolean;
}

export function SpendingLegend({
  data,
  zoomedKey,
  highlightedKey,
  onZoom,
}: SpendingLegendProps): ReactElement {
  const { t, i18n } = useTranslation('dashboard');
  const zoomedIndex = data.categories.findIndex(
    (c) => categoryKey(c) === zoomedKey
  );
  const zoomed = data.categories[zoomedIndex];

  const rows: Row[] = zoomed
    ? zoomed.sub_categories.map((s, i) => ({
        key: s.id,
        name: s.name,
        total: s.total,
        share: s.share_of_category,
        look: {
          colorIndex: zoomedIndex % PALETTE_SIZE,
          tint: i + 1,
          muted: s.archived,
          uncategorized: false,
        },
        zoomable: false,
      }))
    : data.categories.map((c, i) => ({
        key: categoryKey(c),
        name: c.id === null ? t('uncategorized') : c.name,
        total: c.total,
        share: c.share,
        look: {
          colorIndex: i % PALETTE_SIZE,
          tint: 0,
          muted: c.archived,
          uncategorized: c.id === null,
        },
        zoomable: c.id !== null,
      }));

  return (
    <ul className="w-full space-y-1 text-sm">
      {rows.map((row) => {
        const content = (
          <>
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={swatchStyle(row.look)}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{row.name}</span>
            {row.look.muted && (
              <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">
                {t('archived')}
              </span>
            )}
            <span className="font-mono tabular-nums">
              {formatAmount(row.total, data.currency, i18n.language)}
            </span>
            <span className="w-14 text-right tabular-nums text-muted-foreground">
              {row.share.toFixed(2)}%
            </span>
          </>
        );
        const rowClass = cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
          row.key === highlightedKey && 'bg-accent'
        );
        return (
          <li
            key={row.key}
            data-highlighted={row.key === highlightedKey ? 'true' : undefined}
          >
            {row.zoomable ? (
              <button
                type="button"
                className={cn(rowClass, 'hover:bg-accent')}
                onClick={() => onZoom(row.key)}
              >
                {content}
              </button>
            ) : (
              <div className={rowClass}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
