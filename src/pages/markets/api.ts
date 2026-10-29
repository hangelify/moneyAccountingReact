import { apiClient } from '@/auth/apiClient';
import { MARKETS_ENDPOINTS } from '@/const/markets';
import type { MarketResponseDto } from '@/types/markets';

export const marketsApi = {
  list: async (): Promise<MarketResponseDto[]> => {
    const { data } = await apiClient.get<MarketResponseDto[]>(
      MARKETS_ENDPOINTS.LIST
    );
    return data;
  },
};
