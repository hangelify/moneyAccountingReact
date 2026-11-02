import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { billsApi } from '@/pages/bills/api';
import type { BillDetailResponseDto } from '@/types/bills';

export function useBillDetail(
  id: string | undefined
): UseQueryResult<BillDetailResponseDto> {
  const hid = useActiveHouseholdId();
  return useQuery({
    queryKey: ['households', hid, 'bill', id],
    queryFn: () => billsApi.detail(hid!, id!),
    enabled: hid !== null && !!id,
  });
}
