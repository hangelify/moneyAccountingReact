import { apiClient } from '@/auth/apiClient';
import { householdPath } from '@/const/households';
import { SUB_CATEGORIES_ENDPOINTS } from '@/const/categories';
import type { SubCategoryResponse } from '@/types/categories';

export const subCategoriesApi = {
  list: async (hid: string): Promise<SubCategoryResponse[]> => {
    const { data } = await apiClient.get<SubCategoryResponse[]>(
      householdPath(hid, SUB_CATEGORIES_ENDPOINTS.LIST)
    );
    return data;
  },
};
