import type { SpendingCategory, SpendingCurrency } from '@/types/dashboard';

/** Radii as fractions of the unit `viewBox="-1 -1 2 2"`. */
export const RADII = {
  centre: 0.38,
  inner: [0.4, 0.68],
  outer: [0.7, 0.98],
} as const;

export const PALETTE_SIZE = 8;
export const UNCATEGORIZED_KEY = 'uncategorized';

export interface SunburstArc {
  key: string;
  ring: 'inner' | 'outer';
  kind: 'category' | 'sub';
  categoryKey: string;
  start: number; // radians, 0 at 12 o'clock, clockwise
  end: number;
  colorIndex: number;
  tint: number; // 0 for categories; 1..n for subs
  muted: boolean;
  uncategorized: boolean;
  label: string; // raw name; callers translate Uncategorized
  total: number;
  share: number;
}

const TAU = 2 * Math.PI;

export const categoryKey = (c: SpendingCategory): string =>
  c.id ?? UNCATEGORIZED_KEY;

function subArcs(
  c: SpendingCategory,
  colorIndex: number,
  start: number,
  end: number
): SunburstArc[] {
  const subs = c.sub_categories.filter((s) => s.total > 0);
  // Receipt rounding can make subs add up to a few cents over the category.
  const denom = Math.max(
    c.total,
    subs.reduce((sum, s) => sum + s.total, 0)
  );
  if (denom <= 0) return [];
  const arcs: SunburstArc[] = [];
  let at = start;
  subs.forEach((s, i) => {
    const next = at + (s.total / denom) * (end - start);
    arcs.push({
      key: s.id,
      ring: 'outer',
      kind: 'sub',
      categoryKey: categoryKey(c),
      start: at,
      end: next,
      colorIndex,
      tint: i + 1,
      muted: s.archived,
      uncategorized: false,
      label: s.name,
      total: s.total,
      share: s.share_of_category,
    });
    at = next;
  });
  return arcs;
}

function categoryArc(
  c: SpendingCategory,
  colorIndex: number,
  start: number,
  end: number
): SunburstArc {
  return {
    key: categoryKey(c),
    ring: 'inner',
    kind: 'category',
    categoryKey: categoryKey(c),
    start,
    end,
    colorIndex,
    tint: 0,
    muted: c.archived,
    uncategorized: c.id === null,
    label: c.name,
    total: c.total,
    share: c.share,
  };
}

/**
 * Arcs for one currency in API order. With `zoomedKey`, that category fills
 * the inner ring and its sub-categories fill the outer ring.
 */
export function buildSunburst(
  currency: SpendingCurrency,
  zoomedKey: string | null
): SunburstArc[] {
  const indexed = currency.categories.map((c, i) => ({
    c,
    colorIndex: i % PALETTE_SIZE,
  }));

  const zoomed =
    zoomedKey === null
      ? undefined
      : indexed.find(({ c }) => categoryKey(c) === zoomedKey);
  if (zoomed) {
    if (zoomed.c.total <= 0) return [];
    return [
      categoryArc(zoomed.c, zoomed.colorIndex, 0, TAU),
      ...subArcs(zoomed.c, zoomed.colorIndex, 0, TAU),
    ];
  }

  const visible = indexed.filter(({ c }) => c.total > 0);
  const total = visible.reduce((sum, { c }) => sum + c.total, 0);
  if (total <= 0) return [];

  const arcs: SunburstArc[] = [];
  let at = 0;
  for (const { c, colorIndex } of visible) {
    const next = at + (c.total / total) * TAU;
    arcs.push(categoryArc(c, colorIndex, at, next));
    arcs.push(...subArcs(c, colorIndex, at, next));
    at = next;
  }
  return arcs;
}

const fmt = (n: number): string => String(Math.round(n * 1e4) / 1e4);

function point(r: number, angle: number): string {
  return `${fmt(r * Math.sin(angle))} ${fmt(-r * Math.cos(angle))}`;
}

function segment(
  innerR: number,
  outerR: number,
  start: number,
  end: number
): string {
  const large = end - start > Math.PI ? 1 : 0;
  return [
    `M ${point(outerR, start)}`,
    `A ${fmt(outerR)} ${fmt(outerR)} 0 ${large} 1 ${point(outerR, end)}`,
    `L ${point(innerR, end)}`,
    `A ${fmt(innerR)} ${fmt(innerR)} 0 ${large} 0 ${point(innerR, start)}`,
    'Z',
  ].join(' ');
}

/** SVG path for a ring segment. A full circle is drawn as two halves. */
export function arcPath(
  innerR: number,
  outerR: number,
  start: number,
  end: number
): string {
  if (end - start >= TAU - 1e-9) {
    const mid = start + Math.PI;
    return `${segment(innerR, outerR, start, mid)} ${segment(innerR, outerR, mid, start + TAU)}`;
  }
  return segment(innerR, outerR, start, end);
}

export function arcCentroid(
  innerR: number,
  outerR: number,
  start: number,
  end: number
): { x: number; y: number } {
  const r = (innerR + outerR) / 2;
  const a = (start + end) / 2;
  return { x: r * Math.sin(a), y: -r * Math.cos(a) };
}
