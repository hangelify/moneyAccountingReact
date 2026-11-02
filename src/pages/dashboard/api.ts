import { apiClient } from '@/auth/apiClient';
import { householdPath } from '@/const/households';
import { DASHBOARD_ENDPOINTS } from '@/const/dashboard';
import type {
  SpendingBreakdown,
  SpendingBreakdownParams,
} from '@/types/dashboard';

export const dashboardApi = {
  spendingBreakdown: async (
    hid: string,
    params: SpendingBreakdownParams
  ): Promise<SpendingBreakdown> => {
    const { data } = await apiClient.get<SpendingBreakdown>(
      householdPath(hid, DASHBOARD_ENDPOINTS.SPENDING_BREAKDOWN),
      { params }
    );
    return data;
  },
};
