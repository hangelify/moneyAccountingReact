import { apiClient } from '@/auth/apiClient';
import { SUB_CATEGORIES_ENDPOINTS } from '@/const/categories';
import type { SubCategoryResponse } from '@/types/categories';

export const subCategoriesApi = {
  list: async (): Promise<SubCategoryResponse[]> => {
    const { data } = await apiClient.get<SubCategoryResponse[]>(
      SUB_CATEGORIES_ENDPOINTS.LIST
    );
    return data;
  },
};
