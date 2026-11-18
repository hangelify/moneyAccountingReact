import type { LimitPeriodType } from '@/lib/limitPeriods';

/** One version of a category's spending limit (server `CategoryLimitDto`). */
export interface CategoryLimit {
  id: string;
  category_id: string;
  category_name: string;
  category_archived: boolean;
  period_type: LimitPeriodType;
  amount: number;
  currency: string;
  /** First day the version applies, `YYYY-MM-DD`. */
  effective_from: string;
  /** First day it no longer applies; `null` while the limit is open. */
  effective_to: string | null;
}

export interface CreateCategoryLimitRequest {
  category_id: string;
  period_type: LimitPeriodType;
  amount: number;
}

export type UpdateCategoryLimitRequest = Omit<
  CreateCategoryLimitRequest,
  'category_id'
>;
