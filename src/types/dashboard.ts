export type SpendingPeriod =
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | '5y'
  | 'custom';

export type SpendingBreakdownParams =
  | { period: Exclude<SpendingPeriod, 'custom'>; anchor: string }
  | { period: 'custom'; from: string; to: string };

export interface SpendingBreakdown {
  range: { period: SpendingPeriod; start: string; end: string }; // end exclusive
  by_currency: SpendingCurrency[];
  // Every bill of the range converted; absent on older API versions.
  in_household_currency?: SpendingHouseholdCurrency;
}

export interface SpendingCurrency {
  currency: string | null; // null = bills without a currency
  total: number;
  lines: number;
  categories: SpendingCategory[];
}

export interface SpendingCategory {
  id: string | null; // null only for the Uncategorized bucket
  name: string;
  total: number;
  share: number; // % of the currency total, 2 decimals
  archived: boolean;
  sub_categories: SpendingSubCategory[]; // [] for Uncategorized
}

export interface SpendingSubCategory {
  id: string | null; // null = the category's lines without a sub-category; last
  name: string;
  total: number;
  share_of_category: number; // % of the parent category, 2 decimals
  lines: number;
  archived: boolean;
}

export interface UnconvertedBucket {
  currency: string | null; // null = bills without a currency
  bill_count: number;
  amount: number; // in that original currency
}

export interface SpendingHouseholdCurrency extends SpendingCurrency {
  unconverted: UnconvertedBucket[]; // bills left out of the totals
}
