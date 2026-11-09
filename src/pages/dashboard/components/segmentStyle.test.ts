import { describe, it, expect } from 'vitest';
import { hatchId, segmentStyle, swatchStyle } from './segmentStyle';

const look = {
  colorIndex: 2,
  tint: 1,
  muted: false,
  uncategorized: false,
  noSub: false,
};

describe('segmentStyle', () => {
  it('fills a sub-category with a tint of its category colour', () => {
    expect(segmentStyle(look)).toEqual({
      fill: 'hsl(var(--chart-3))',
      fillOpacity: 0.85,
    });
  });

  it('hatches the no-sub-category slice in its category colour', () => {
    expect(segmentStyle({ ...look, noSub: true }, 'chart1')).toEqual({
      fill: `url(#${hatchId('chart1', 2)})`,
    });
  });

  it('mutes an archived no-sub-category slice like any archived one', () => {
    expect(
      segmentStyle({ ...look, noSub: true, muted: true }, 'chart1')
    ).toEqual({ fill: 'hsl(var(--muted-foreground))', fillOpacity: 0.35 });
  });
});

describe('swatchStyle', () => {
  it('stripes the no-sub-category swatch in its category colour', () => {
    const s = swatchStyle({ ...look, noSub: true });
    expect(s.backgroundImage).toContain('repeating-linear-gradient');
    expect(s.backgroundImage).toContain('var(--chart-3)');
    expect(s.backgroundColor).toBeUndefined();
  });

  it('keeps a plain swatch for a sub-category', () => {
    expect(swatchStyle(look)).toMatchObject({
      backgroundColor: 'hsl(var(--chart-3))',
      opacity: 0.85,
    });
  });
});
