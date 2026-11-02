import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { marketsApi } from '@/pages/markets/api';
import type { MarketResponseDto } from '@/types/markets';

export function useMarkets(): UseQueryResult<MarketResponseDto[]> {
  const hid = useActiveHouseholdId();
  return useQuery({
    queryKey: ['households', hid, 'markets'],
    queryFn: () => marketsApi.list(hid!),
    enabled: hid !== null,
    staleTime: 5 * 60 * 1000,
  });
}
