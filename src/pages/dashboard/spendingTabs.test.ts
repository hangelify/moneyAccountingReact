import { describe, it, expect } from 'vitest';
import { EUR, MDL, breakdown, inHousehold } from '@/test/spending';
import { HOUSEHOLD_TAB, defaultTab, spendingTabs } from './spendingTabs';

const RANGE = {
  period: 'month',
  start: '2026-10-01',
  end: '2026-11-01',
} as const;
const converted = inHousehold({ ...MDL, currency: 'EUR', total: 2062.52 });
const keys = (b: ReturnType<typeof breakdown>): string[] =>
  spendingTabs(b).map((t) => t.key);

describe('spendingTabs', () => {
  it('adds the household tab after the original currencies', () => {
    expect(keys(breakdown([EUR, MDL], RANGE, converted))).toEqual([
      'EUR',
      'MDL',
      HOUSEHOLD_TAB,
    ]);
  });

  it('keys bills without a currency as none', () => {
    expect(keys(breakdown([{ ...MDL, currency: null }]))).toEqual(['none']);
  });

  it('has no household tab when the API sends none', () => {
    expect(keys(breakdown([EUR, MDL]))).toEqual(['EUR', 'MDL']);
  });

  it('hides the household tab when it would repeat the only currency', () => {
    expect(keys(breakdown([EUR], RANGE, inHousehold(EUR)))).toEqual(['EUR']);
  });

  it('has no tabs for an empty range', () => {
    const empty = inHousehold({ ...EUR, total: 0, lines: 0, categories: [] });
    expect(keys(breakdown([], RANGE, empty))).toEqual([]);
  });

  it('keeps the household tab when some bills were left out', () => {
    const tree = inHousehold(EUR, [
      { currency: null, bill_count: 1, amount: 31 },
    ]);
    expect(keys(breakdown([EUR], RANGE, tree))).toEqual(['EUR', HOUSEHOLD_TAB]);
  });

  it('defaults to the largest original currency, never the household tab', () => {
    const tabs = spendingTabs(breakdown([MDL, EUR], RANGE, converted));
    expect(defaultTab(tabs)?.key).toBe('EUR');
  });
});
