import type { CSSProperties } from 'react';

export interface SegmentLook {
  colorIndex: number;
  tint: number; // 0 for categories; 1..n for sub-categories
  muted: boolean;
  uncategorized: boolean;
}

/** Fill for a sunburst arc or its legend swatch. */
export function segmentStyle({
  colorIndex,
  tint,
  muted,
  uncategorized,
}: SegmentLook): CSSProperties {
  if (muted) {
    return { fill: 'hsl(var(--muted-foreground))', fillOpacity: 0.35 };
  }
  if (uncategorized) {
    return { fill: 'hsl(var(--muted))', stroke: 'hsl(var(--border))' };
  }
  return {
    fill: `hsl(var(--chart-${colorIndex + 1}))`,
    fillOpacity: tint === 0 ? 1 : Math.max(0.45, 0.85 - (tint - 1) * 0.1),
  };
}

/** The same look as a CSS background, for HTML swatches. */
export function swatchStyle(look: SegmentLook): CSSProperties {
  const s = segmentStyle(look);
  return {
    backgroundColor: s.fill as string,
    opacity: s.fillOpacity,
    border: s.stroke ? `1px solid ${s.stroke as string}` : undefined,
  };
}
