import type { KeyboardEvent, PointerEvent, ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { cn } from '@/lib/utils';
import type { SpendingCurrency } from '@/types/dashboard';
import { formatAmount } from '../format';
import {
  RADII,
  arcCentroid,
  arcPath,
  buildSunburst,
  categoryKey,
  type SunburstArc,
} from '../sunburstGeometry';
import { segmentStyle } from './segmentStyle';

export interface SpendingSunburstProps {
  data: SpendingCurrency;
  centreLabel: string;
  zoomedKey: string | null;
  onZoom: (key: string | null) => void;
  highlightedKey: string | null;
  onHighlight: (key: string | null) => void;
}

interface Tip {
  arc: SunburstArc;
  x: number; // % of the chart width
  y: number;
}

const radii = (arc: SunburstArc): readonly [number, number] =>
  arc.ring === 'inner' ? RADII.inner : RADII.outer;

export function SpendingSunburst({
  data,
  centreLabel,
  zoomedKey,
  onZoom,
  highlightedKey,
  onHighlight,
}: SpendingSunburstProps): ReactElement {
  const { t, i18n } = useTranslation('dashboard');
  const canHover = useMediaQuery('(hover: hover)');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const zoomed = zoomedKey
    ? data.categories.find((c) => categoryKey(c) === zoomedKey)
    : undefined;

  // The zoomed category can vanish after a refetch or a household switch.
  useEffect(() => {
    if (zoomedKey !== null && !zoomed) onZoom(null);
  }, [zoomedKey, zoomed, onZoom]);

  const arcs = useMemo(
    () => buildSunburst(data, zoomed ? zoomedKey : null),
    [data, zoomed, zoomedKey]
  );

  const money = (n: number): string =>
    formatAmount(n, data.currency, i18n.language);
  const nameOf = (arc: SunburstArc): string =>
    arc.uncategorized ? t('uncategorized') : arc.label;

  const activate = (arc: SunburstArc): void => {
    if (arc.kind === 'sub') onHighlight(arc.key);
    else if (zoomed) onZoom(null);
    // Uncategorized has no sub-categories to zoom into.
    else if (!arc.uncategorized) onZoom(arc.key);
  };

  const onKeyDown = (
    e: KeyboardEvent<SVGPathElement>,
    arc: SunburstArc
  ): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(arc);
    }
  };

  const tipAtPointer = (e: PointerEvent, arc: SunburstArc): void => {
    if (!canHover) return;
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) {
      setTip({ arc, x: 50, y: 50 });
      return;
    }
    setTip({
      arc,
      x: ((e.clientX - box.left) / box.width) * 100,
      y: ((e.clientY - box.top) / box.height) * 100,
    });
  };

  const tipAtArc = (arc: SunburstArc): void => {
    if (!canHover) return;
    const [r0, r1] = radii(arc);
    const c = arcCentroid(r0, r1, arc.start, arc.end);
    setTip({ arc, x: ((c.x + 1) / 2) * 100, y: ((c.y + 1) / 2) * 100 });
  };

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto aspect-square w-full max-w-[22rem]"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && zoomed) onZoom(null);
      }}
      onPointerLeave={() => setTip(null)}
    >
      <svg viewBox="-1 -1 2 2" className="h-full w-full">
        <circle
          r={RADII.centre}
          className={cn('fill-transparent', zoomed && 'cursor-pointer')}
          onClick={() => {
            if (zoomed) onZoom(null);
          }}
        />
        {arcs.map((arc) => {
          const [r0, r1] = radii(arc);
          const active = arc.key === highlightedKey || arc.key === tip?.arc.key;
          return (
            <path
              key={`${arc.ring}-${arc.key}`}
              d={arcPath(r0, r1, arc.start, arc.end)}
              role="button"
              tabIndex={0}
              aria-label={t('segmentLabel', {
                name: nameOf(arc),
                amount: money(arc.total),
                share: arc.share.toFixed(2),
              })}
              style={segmentStyle(arc)}
              stroke="hsl(var(--card))"
              strokeWidth={active ? 0.02 : 0.006}
              className="cursor-pointer outline-none transition-[stroke-width] focus-visible:opacity-80"
              onClick={() => activate(arc)}
              onKeyDown={(e) => onKeyDown(e, arc)}
              onPointerEnter={(e) => tipAtPointer(e, arc)}
              onPointerMove={(e) => tipAtPointer(e, arc)}
              onFocus={() => tipAtArc(arc)}
              onBlur={() => setTip(null)}
            />
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex w-[34%] flex-col items-center gap-0.5 text-center">
          {zoomed ? (
            <>
              <span className="w-full truncate text-sm font-medium">
                {zoomed.id === null ? t('uncategorized') : zoomed.name}
              </span>
              <span className="text-base font-semibold sm:text-lg">
                {money(zoomed.total)}
              </span>
              <button
                type="button"
                className="pointer-events-auto mt-1 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => onZoom(null)}
              >
                <ChevronLeft className="h-3 w-3" aria-hidden />
                {t('back')}
              </button>
            </>
          ) : (
            <>
              <span className="text-base font-semibold sm:text-lg">
                {money(data.total)}
              </span>
              <span className="line-clamp-2 w-full text-xs leading-tight text-muted-foreground">
                {centreLabel}
              </span>
            </>
          )}
        </div>
      </div>

      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 w-max max-w-[14rem] -translate-x-1/2 -translate-y-[calc(100%+0.5rem)] rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md"
          style={{ left: `${tip.x}%`, top: `${tip.y}%` }}
        >
          <div className="font-medium">
            {nameOf(tip.arc)}
            {tip.arc.muted && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({t('archived')})
              </span>
            )}
          </div>
          <div className="text-muted-foreground">
            {money(tip.arc.total)} · {tip.arc.share.toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
}
