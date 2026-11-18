import { apiClient } from '@/auth/apiClient';
import { CATEGORY_LIMITS_ENDPOINTS } from '@/const/categoryLimits';
import { householdPath } from '@/const/households';
import type {
  CategoryLimit,
  CreateCategoryLimitRequest,
  UpdateCategoryLimitRequest,
} from '@/types/categoryLimits';

export const categoryLimitsApi = {
  /** Limits in force today (open and ending), one per category. */
  list: async (hid: string): Promise<CategoryLimit[]> => {
    const { data } = await apiClient.get<CategoryLimit[]>(
      householdPath(hid, CATEGORY_LIMITS_ENDPOINTS.LIST)
    );
    return data;
  },

  create: async (
    hid: string,
    body: CreateCategoryLimitRequest
  ): Promise<CategoryLimit> => {
    const { data } = await apiClient.post<CategoryLimit>(
      householdPath(hid, CATEGORY_LIMITS_ENDPOINTS.LIST),
      body
    );
    return data;
  },

  update: async (
    hid: string,
    categoryId: string,
    body: UpdateCategoryLimitRequest
  ): Promise<CategoryLimit> => {
    const { data } = await apiClient.put<CategoryLimit>(
      householdPath(hid, CATEGORY_LIMITS_ENDPOINTS.ONE(categoryId)),
      body
    );
    return data;
  },

  /** Ends the open limit at the end of its current period. */
  remove: async (hid: string, categoryId: string): Promise<CategoryLimit> => {
    const { data } = await apiClient.delete<CategoryLimit>(
      householdPath(hid, CATEGORY_LIMITS_ENDPOINTS.ONE(categoryId))
    );
    return data;
  },
};
