import type { ReactElement, ReactNode } from 'react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SpendingCategory, SpendingCurrency } from '@/types/dashboard';
import { formatAmount } from '../format';
import { PALETTE_SIZE, categoryKey, subKey } from '../sunburstGeometry';
import { swatchStyle, type SegmentLook } from './segmentStyle';

export interface SpendingLegendProps {
  data: SpendingCurrency;
  zoomedKey: string | null;
  highlightedKey: string | null;
}

interface Row {
  key: string;
  name: string;
  total: number;
  share: number;
  look: SegmentLook;
  lines?: number;
}

const subRows = (
  c: SpendingCategory,
  colorIndex: number,
  noSubName: string
): Row[] =>
  c.sub_categories.map((s, i) => ({
    key: subKey(c, s),
    name: s.id === null ? noSubName : s.name,
    total: s.total,
    share: s.share_of_category,
    look: {
      colorIndex,
      tint: i + 1,
      muted: s.archived,
      uncategorized: false,
      noSub: s.id === null,
    },
    lines: s.lines,
  }));

/**
 * Categories at the top level, each expandable in place to its
 * sub-categories so the chart can stay on the whole picture; the zoomed
 * category's sub-categories while zoomed. Zooming happens on the chart.
 */
export function SpendingLegend({
  data,
  zoomedKey,
  highlightedKey,
}: SpendingLegendProps): ReactElement {
  const { t, i18n } = useTranslation('dashboard');
  const baseId = useId();
  // The card remounts the legend on any view change, which collapses it.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string): void =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const zoomedIndex = data.categories.findIndex(
    (c) => categoryKey(c) === zoomedKey
  );
  const zoomed = data.categories[zoomedIndex];

  const rowContent = (row: Row, lead?: ReactNode): ReactElement => (
    <>
      {lead}
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
      {row.lines !== undefined && (
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {t('lines', { count: row.lines })}
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
  const rowClass = (key: string): string =>
    cn(
      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
      key === highlightedKey && 'bg-accent'
    );
  const plainRow = (row: Row, lead?: ReactNode): ReactElement => (
    <li
      key={row.key}
      data-highlighted={row.key === highlightedKey ? 'true' : undefined}
    >
      <div className={rowClass(row.key)}>{rowContent(row, lead)}</div>
    </li>
  );

  if (zoomed) {
    return (
      <ul className="w-full space-y-1 text-sm">
        {subRows(zoomed, zoomedIndex % PALETTE_SIZE, t('noSubCategory')).map(
          (row) => plainRow(row)
        )}
      </ul>
    );
  }

  return (
    <ul className="w-full space-y-1 text-sm">
      {data.categories.map((c, i) => {
        const colorIndex = i % PALETTE_SIZE;
        const row: Row = {
          key: categoryKey(c),
          name: c.id === null ? t('uncategorized') : c.name,
          total: c.total,
          share: c.share,
          look: {
            colorIndex,
            tint: 0,
            muted: c.archived,
            uncategorized: c.id === null,
            noSub: false,
          },
        };
        if (c.sub_categories.length === 0) {
          // The spacer lines names up with the expandable rows' chevrons.
          return plainRow(
            row,
            <span className="h-4 w-4 shrink-0" aria-hidden />
          );
        }
        const open = expanded.has(row.key);
        const listId = `${baseId}-${row.key}`;
        return (
          <li
            key={row.key}
            data-highlighted={row.key === highlightedKey ? 'true' : undefined}
          >
            <button
              type="button"
              className={cn(rowClass(row.key), 'hover:bg-accent')}
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => toggle(row.key)}
            >
              {rowContent(
                row,
                <ChevronRight
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                    open && 'rotate-90'
                  )}
                  aria-hidden
                />
              )}
            </button>
            {open && (
              <ul
                id={listId}
                aria-label={row.name}
                className="mb-1 ml-6 space-y-0.5 border-l pl-2 text-xs sm:text-sm"
              >
                {subRows(c, colorIndex, t('noSubCategory')).map((sub) =>
                  plainRow(sub)
                )}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
