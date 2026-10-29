import { apiClient } from '@/auth/apiClient';
import { householdPath } from '@/const/households';
import { MARKETS_ENDPOINTS } from '@/const/markets';
import type { MarketResponseDto } from '@/types/markets';

export const marketsApi = {
  list: async (hid: string): Promise<MarketResponseDto[]> => {
    const { data } = await apiClient.get<MarketResponseDto[]>(
      householdPath(hid, MARKETS_ENDPOINTS.LIST)
    );
    return data;
  },
};
