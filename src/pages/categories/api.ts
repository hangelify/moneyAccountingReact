import { apiClient } from '@/auth/apiClient';
import { householdPath } from '@/const/households';
import {
  CATEGORIES_ENDPOINTS,
  SUB_CATEGORIES_ENDPOINTS,
} from '@/const/categories';
import type { CategoryResponse, SubCategoryResponse } from '@/types/categories';

export const categoriesApi = {
  list: async (hid: string): Promise<CategoryResponse[]> => {
    const { data } = await apiClient.get<CategoryResponse[]>(
      householdPath(hid, CATEGORIES_ENDPOINTS.LIST)
    );
    return data;
  },
};

export const subCategoriesApi = {
  list: async (hid: string): Promise<SubCategoryResponse[]> => {
    const { data } = await apiClient.get<SubCategoryResponse[]>(
      householdPath(hid, SUB_CATEGORIES_ENDPOINTS.LIST)
    );
    return data;
  },
};
