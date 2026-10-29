import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { billsApi } from '@/pages/bills/api';
import type { ConfirmedBillsFilters } from '@/pages/bills/buildBillsQueryParams';
import type { Paginated } from '@/types/pagination';
import type { BillResponseDto } from '@/types/bills';

export function useConfirmedBills(
  filters: ConfirmedBillsFilters,
  page: number,
  limit: number
): UseQueryResult<Paginated<BillResponseDto>> {
  const hid = useActiveHouseholdId();
  return useQuery({
    queryKey: ['households', hid, 'bills', filters, page, limit],
    queryFn: () => billsApi.list(hid!, filters, page, limit),
    enabled: hid !== null,
    // Keep previous rows only within one household, never across a switch.
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey[1] === hid ? prev : undefined,
  });
}
