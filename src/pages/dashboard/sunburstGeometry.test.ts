import { describe, it, expect } from 'vitest';
import type { SpendingCategory, SpendingCurrency } from '@/types/dashboard';
import { arcPath, buildSunburst, type SunburstArc } from './sunburstGeometry';

const TAU = 2 * Math.PI;

const food: SpendingCategory = {
  id: 'food',
  name: 'Food',
  total: 910.4,
  share: 72.81,
  archived: false,
  sub_categories: [
    {
      id: 'bread',
      name: 'Bread',
      total: 500.4,
      share_of_category: 54.97,
      lines: 25,
      archived: false,
    },
    {
      id: 'dairy',
      name: 'Dairy',
      total: 410,
      share_of_category: 45.03,
      lines: 21,
      archived: false,
    },
  ],
};
const home: SpendingCategory = {
  id: 'home',
  name: 'Home',
  total: 100,
  share: 8,
  archived: true,
  sub_categories: [
    {
      id: 'lamp',
      name: 'Lamps',
      total: 100,
      share_of_category: 100,
      lines: 1,
      archived: true,
    },
  ],
};
const uncategorized: SpendingCategory = {
  id: null,
  name: 'Uncategorized',
  total: 240,
  share: 19.19,
  archived: false,
  sub_categories: [],
};

const currency = (categories: SpendingCategory[]): SpendingCurrency => ({
  currency: 'MDL',
  total: categories.reduce((s, c) => s + c.total, 0),
  lines: 50,
  categories,
});

const MDL = currency([food, home, uncategorized]);
const inner = (arcs: SunburstArc[]): SunburstArc[] =>
  arcs.filter((a) => a.ring === 'inner');
const outer = (arcs: SunburstArc[]): SunburstArc[] =>
  arcs.filter((a) => a.ring === 'outer');

describe('buildSunburst', () => {
  it('inner arcs sum to 2π in API order', () => {
    const arcs = inner(buildSunburst(MDL, null));
    expect(arcs.map((a) => a.key)).toEqual(['food', 'home', 'uncategorized']);
    expect(arcs[0]!.start).toBe(0);
    expect(arcs.at(-1)!.end).toBeCloseTo(TAU, 6);
    expect(arcs[0]!.end - arcs[0]!.start).toBeCloseTo(
      (910.4 / 1250.4) * TAU,
      6
    );
  });

  it('subs stay inside their parent', () => {
    const arcs = buildSunburst(MDL, null);
    for (const sub of outer(arcs)) {
      const parent = inner(arcs).find((a) => a.key === sub.categoryKey)!;
      expect(sub.start).toBeGreaterThanOrEqual(parent.start - 1e-9);
      expect(sub.end).toBeLessThanOrEqual(parent.end + 1e-9);
    }
  });

  it('uncategorized has no outer arc', () => {
    const arcs = buildSunburst(MDL, null);
    expect(outer(arcs).some((a) => a.categoryKey === 'uncategorized')).toBe(
      false
    );
    expect(
      inner(arcs).find((a) => a.key === 'uncategorized')!.uncategorized
    ).toBe(true);
  });

  it('muted follows archived', () => {
    const arcs = buildSunburst(MDL, null);
    expect(arcs.find((a) => a.key === 'home')!.muted).toBe(true);
    expect(arcs.find((a) => a.key === 'lamp')!.muted).toBe(true);
    expect(arcs.find((a) => a.key === 'food')!.muted).toBe(false);
  });

  it('colorIndex is the category position mod 8; subs share it with a tint', () => {
    const many = currency(
      Array.from({ length: 9 }, (_, i) => ({
        ...food,
        id: `c${i}`,
        sub_categories: [],
      }))
    );
    expect(inner(buildSunburst(many, null)).map((a) => a.colorIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 0,
    ]);
    const subs = outer(buildSunburst(MDL, null)).filter(
      (a) => a.categoryKey === 'food'
    );
    expect(subs.map((a) => [a.colorIndex, a.tint])).toEqual([
      [0, 1],
      [0, 2],
    ]);
  });

  it('carries totals and shares for labels', () => {
    const arcs = buildSunburst(MDL, null);
    expect(arcs.find((a) => a.key === 'food')).toMatchObject({
      total: 910.4,
      share: 72.81,
      label: 'Food',
    });
    expect(arcs.find((a) => a.key === 'dairy')).toMatchObject({
      total: 410,
      share: 45.03,
      kind: 'sub',
    });
  });

  it('zoom fills the circle', () => {
    const arcs = buildSunburst(MDL, 'food');
    expect(inner(arcs)).toHaveLength(1);
    expect(inner(arcs)[0]).toMatchObject({ key: 'food', start: 0 });
    expect(inner(arcs)[0]!.end).toBeCloseTo(TAU, 6);
    expect(outer(arcs).map((a) => a.key)).toEqual(['bread', 'dairy']);
    expect(outer(arcs).at(-1)!.end).toBeCloseTo(TAU, 6);
  });

  it('skips non-positive totals without NaN', () => {
    expect(
      buildSunburst(currency([{ ...food, total: 0, sub_categories: [] }]), null)
    ).toEqual([]);
    const withRefund = currency([
      food,
      { ...home, archived: false, total: -20, sub_categories: [] },
      { ...uncategorized, total: 0 },
    ]);
    const arcs = buildSunburst(withRefund, null);
    expect(inner(arcs).map((a) => a.key)).toEqual(['food']);
    for (const a of arcs) {
      expect(Number.isFinite(a.start) && Number.isFinite(a.end)).toBe(true);
    }
  });

  it('keeps subs inside parent when they sum over the category total', () => {
    const over = currency([
      {
        ...food,
        total: 100,
        sub_categories: [
          { ...food.sub_categories[0]!, total: 60 },
          { ...food.sub_categories[1]!, total: 40.02 },
        ],
      },
    ]);
    const arcs = buildSunburst(over, null);
    expect(outer(arcs).at(-1)!.end).toBeLessThanOrEqual(
      inner(arcs)[0]!.end + 1e-9
    );
  });
});

describe('arcPath', () => {
  it('draws a ring segment', () => {
    const d = arcPath(0.4, 0.68, 0, Math.PI / 2);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).not.toContain('NaN');
  });

  it('draws a full circle without radial edges, so no seam shows', () => {
    const d = arcPath(0.4, 0.68, 0, TAU);
    expect(d).not.toContain('L');
  });

  it('splits a full circle into two halves', () => {
    const d = arcPath(0.4, 0.68, 0, TAU);
    expect(d.match(/A 0\.68/g)).toHaveLength(2);
    expect(d).not.toContain('NaN');
  });
});
