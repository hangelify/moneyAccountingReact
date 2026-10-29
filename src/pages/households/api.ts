import { apiClient } from '@/auth/apiClient';
import { HOUSEHOLDS_ENDPOINTS } from '@/const/households';
import type { Household } from '@/types/households';

export const householdsApi = {
  list: async (): Promise<Household[]> => {
    const { data } = await apiClient.get<Household[]>(
      HOUSEHOLDS_ENDPOINTS.LIST
    );
    return [...data].sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.name.localeCompare(b.name)
    );
  },
};
