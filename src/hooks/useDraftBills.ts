import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { billsApi } from '@/pages/bills/api';
import type { Paginated } from '@/types/pagination';
import type { DraftBillDto } from '@/types/bills';

export function useDraftBills(
  page: number,
  limit: number
): UseQueryResult<Paginated<DraftBillDto>> {
  const hid = useActiveHouseholdId();
  return useQuery({
    // Under ['households', hid, 'bills'] so a bill save refreshes drafts too.
    queryKey: ['households', hid, 'bills', 'drafts', page, limit],
    queryFn: () => billsApi.listDrafts(hid!, page, limit),
    enabled: hid !== null,
    // Keep previous rows only within one household, never across a switch.
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey[1] === hid ? prev : undefined,
  });
}
