import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { dashboardApi } from '@/pages/dashboard/api';
import type {
  SpendingBreakdown,
  SpendingBreakdownParams,
} from '@/types/dashboard';

export function useSpendingBreakdown(
  params: SpendingBreakdownParams
): UseQueryResult<SpendingBreakdown> {
  const hid = useActiveHouseholdId();
  return useQuery({
    // Under ['households', hid, 'dashboard'] so bill mutations refresh it.
    queryKey: ['households', hid, 'dashboard', 'spending-breakdown', params],
    queryFn: () => dashboardApi.spendingBreakdown(hid!, params),
    enabled: hid !== null,
    // Keep the previous chart only within one household, never across a switch.
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey[1] === hid ? prev : undefined,
  });
}
