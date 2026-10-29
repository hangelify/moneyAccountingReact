import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { marketsApi } from '@/pages/markets/api';
import type { MarketResponseDto } from '@/types/markets';

export function useMarkets(): UseQueryResult<MarketResponseDto[]> {
  return useQuery({
    queryKey: ['markets'],
    queryFn: marketsApi.list,
    staleTime: 5 * 60 * 1000,
  });
}
