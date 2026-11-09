import type { CSSProperties } from 'react';

export interface SegmentLook {
  colorIndex: number;
  tint: number; // 0 for categories; 1..n for sub-categories
  muted: boolean;
  uncategorized: boolean;
  noSub: boolean; // the category's lines without a sub-category: hatched
}

const chartColor = (colorIndex: number): string =>
  `var(--chart-${colorIndex + 1})`;

/** Id of the sunburst's hatch `<pattern>` for one palette colour. */
export const hatchId = (prefix: string, colorIndex: number): string =>
  `${prefix}-hatch-${colorIndex}`;

/**
 * Fill for a sunburst arc or its legend swatch. A no-sub-category arc needs
 * `hatchPrefix`, the prefix its chart's hatch patterns were drawn with.
 */
export function segmentStyle(
  { colorIndex, tint, muted, uncategorized, noSub }: SegmentLook,
  hatchPrefix?: string
): CSSProperties {
  if (muted) {
    return { fill: 'hsl(var(--muted-foreground))', fillOpacity: 0.35 };
  }
  if (uncategorized) {
    return { fill: 'hsl(var(--muted))', stroke: 'hsl(var(--border))' };
  }
  if (noSub && hatchPrefix !== undefined) {
    return { fill: `url(#${hatchId(hatchPrefix, colorIndex)})` };
  }
  return {
    fill: `hsl(${chartColor(colorIndex)})`,
    fillOpacity: tint === 0 ? 1 : Math.max(0.45, 0.85 - (tint - 1) * 0.1),
  };
}

/** The same look as a CSS background, for HTML swatches. */
export function swatchStyle(look: SegmentLook): CSSProperties {
  if (look.noSub && !look.muted) {
    const c = chartColor(look.colorIndex);
    return {
      backgroundImage: `repeating-linear-gradient(45deg, hsl(${c}) 0 2px, hsl(${c} / 0.3) 2px 4px)`,
    };
  }
  const s = segmentStyle(look);
  return {
    backgroundColor: s.fill as string,
    opacity: s.fillOpacity,
    border: s.stroke ? `1px solid ${s.stroke as string}` : undefined,
  };
}
