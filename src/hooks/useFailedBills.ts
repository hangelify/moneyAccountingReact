import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { billsApi } from '@/pages/bills/api';
import type { Paginated } from '@/types/pagination';
import type { DraftBillDto } from '@/types/bills';

export function useFailedBills(
  page: number,
  limit: number
): UseQueryResult<Paginated<DraftBillDto>> {
  const hid = useActiveHouseholdId();
  return useQuery({
    // Under the drafts prefix so one invalidation refreshes both lists.
    queryKey: ['households', hid, 'bills', 'drafts', 'failed', page, limit],
    queryFn: () => billsApi.listDrafts(hid ?? '', page, limit, 'failed'),
    enabled: hid !== null,
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey[1] === hid ? prev : undefined,
  });
}
