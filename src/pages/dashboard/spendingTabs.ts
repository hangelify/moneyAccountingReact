import type { SpendingBreakdown, SpendingCurrency } from '@/types/dashboard';

export const HOUSEHOLD_TAB = 'household';

export interface SpendingTab {
  key: string; // currency code, 'none' for bills without one, or HOUSEHOLD_TAB
  currency: string | null;
  data: SpendingCurrency;
  household: boolean;
}

/**
 * One tab per original currency, in API order, then the household currency
 * tab. That last tab is left out when it would repeat the only currency.
 */
export function spendingTabs(b: SpendingBreakdown): SpendingTab[] {
  const tabs: SpendingTab[] = b.by_currency.map((c) => ({
    key: c.currency ?? 'none',
    currency: c.currency,
    data: c,
    household: false,
  }));
  const hh = b.in_household_currency;
  if (!hh) return tabs;
  const [only] = b.by_currency;
  const repeats =
    b.by_currency.length === 1 &&
    only?.currency === hh.currency &&
    hh.unconverted.length === 0;
  if (!repeats) {
    tabs.push({
      key: HOUSEHOLD_TAB,
      currency: hh.currency,
      data: hh,
      household: true,
    });
  }
  return tabs;
}

/** The original currency with the most spending; the first one on ties. */
export function defaultTab(tabs: SpendingTab[]): SpendingTab | undefined {
  const best = tabs.reduce<SpendingTab | undefined>(
    (acc, t) =>
      !t.household && (acc === undefined || t.data.total > acc.data.total)
        ? t
        : acc,
    undefined
  );
  return best ?? tabs[0];
}
