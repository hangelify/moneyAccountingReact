import { describe, it, expect } from 'vitest';
import type { SpendingBreakdownParams } from '@/types/dashboard';
import {
  parseSpendingSearchParams,
  toSpendingSearchParams,
} from './parseSpendingSearchParams';

const TODAY = '2026-10-31';
const DEFAULTS = { period: 'month', anchor: TODAY };

const parse = (qs: string): ReturnType<typeof parseSpendingSearchParams> =>
  parseSpendingSearchParams(new URLSearchParams(qs), TODAY);

describe('parseSpendingSearchParams', () => {
  it('defaults an empty URL to month/today without flagging it', () => {
    expect(parse('')).toEqual({ params: DEFAULTS, invalid: false });
  });

  it('fills a missing anchor with today', () => {
    expect(parse('period=week')).toEqual({
      params: { period: 'week', anchor: TODAY },
      invalid: false,
    });
  });

  it('keeps a valid period and anchor', () => {
    expect(parse('period=year&anchor=2025-06-01')).toEqual({
      params: { period: 'year', anchor: '2025-06-01' },
      invalid: false,
    });
  });

  it('keeps a valid custom range', () => {
    expect(parse('period=custom&from=2026-03-05&to=2026-03-20')).toEqual({
      params: { period: 'custom', from: '2026-03-05', to: '2026-03-20' },
      invalid: false,
    });
  });

  it.each([
    ['an impossible anchor', 'period=month&anchor=2026-02-30'],
    ['an unknown period', 'period=decade'],
    ['custom without to', 'period=custom&from=2026-03-05'],
    ['custom of 10 years', 'period=custom&from=2016-11-01&to=2026-11-01'],
    [
      'custom ending before it starts',
      'period=custom&from=2026-03-05&to=2026-03-01',
    ],
  ])('falls back to defaults and flags %s', (_, qs) => {
    expect(parse(qs)).toEqual({ params: DEFAULTS, invalid: true });
  });
});

describe('toSpendingSearchParams', () => {
  it.each<SpendingBreakdownParams>([
    { period: 'quarter', anchor: '2026-07-15' },
    { period: 'custom', from: '2026-03-05', to: '2026-03-20' },
  ])('round-trips %o', (p) => {
    expect(
      parseSpendingSearchParams(toSpendingSearchParams(p), TODAY).params
    ).toEqual(p);
  });

  it('writes no anchor for custom', () => {
    const sp = toSpendingSearchParams({
      period: 'custom',
      from: '2026-03-05',
      to: '2026-03-20',
    });
    expect(sp.has('anchor')).toBe(false);
  });
});
