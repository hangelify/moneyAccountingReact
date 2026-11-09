import type {
  SpendingBreakdown,
  SpendingCategory,
  SpendingCurrency,
  SpendingHouseholdCurrency,
  SpendingSubCategory,
  UnconvertedBucket,
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

export const inHousehold = (
  tree: SpendingCurrency,
  unconverted: UnconvertedBucket[] = []
): SpendingHouseholdCurrency => ({ ...tree, unconverted });

export const breakdown = (
  by_currency: SpendingCurrency[],
  range: SpendingBreakdown['range'] = {
    period: 'month',
    start: '2026-10-01',
    end: '2026-11-01',
  },
  in_household_currency?: SpendingHouseholdCurrency
): SpendingBreakdown => ({
  range,
  by_currency,
  ...(in_household_currency && { in_household_currency }),
});

/**
 * The no-sub-category slice as the API sends it: id null. The client
 * translates its name, so the raw one here differs from the translation.
 */
export const noSub = (
  total: number,
  share_of_category: number,
  lines = 1
): SpendingSubCategory => ({
  id: null,
  name: 'raw no-sub name',
  total,
  share_of_category,
  lines,
  archived: false,
});

// Food with lines that have only the category, and Tea with nothing but those.
export const MDL_NO_SUB: SpendingCurrency = {
  currency: 'MDL',
  total: 1350.4,
  lines: 61,
  categories: [
    {
      ...FOOD,
      total: 960.4,
      share: 71.12,
      sub_categories: [
        { ...FOOD.sub_categories[0]!, share_of_category: 52.1 },
        { ...FOOD.sub_categories[1]!, share_of_category: 42.69 },
        noSub(50, 5.21, 2),
      ],
    },
    {
      id: 'tea',
      name: 'Tea',
      total: 50,
      share: 3.7,
      archived: false,
      sub_categories: [noSub(50, 100)],
    },
    { ...UNCATEGORIZED, share: 25.18 },
  ],
};
