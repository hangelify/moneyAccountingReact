import type {
  SpendingBreakdown,
  SpendingCategory,
  SpendingCurrency,
} from '@/types/dashboard';

export const FOOD: SpendingCategory = {
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

export const UNCATEGORIZED: SpendingCategory = {
  id: null,
  name: 'Uncategorized',
  total: 340,
  share: 27.19,
  archived: false,
  sub_categories: [],
};

export const MDL: SpendingCurrency = {
  currency: 'MDL',
  total: 1250.4,
  lines: 58,
  categories: [FOOD, UNCATEGORIZED],
};

export const EUR: SpendingCurrency = {
  currency: 'EUR',
  total: 2000,
  lines: 3,
  categories: [
    { ...FOOD, id: 'food-eur', total: 2000, share: 100, sub_categories: [] },
  ],
};

export const breakdown = (
  by_currency: SpendingCurrency[],
  range: SpendingBreakdown['range'] = {
    period: 'month',
    start: '2026-10-01',
    end: '2026-11-01',
  }
): SpendingBreakdown => ({ range, by_currency });
