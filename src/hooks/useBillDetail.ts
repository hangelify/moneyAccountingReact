import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { billsApi } from '@/pages/bills/api';
import type { BillDetailResponseDto } from '@/types/bills';

export function useBillDetail(
  id: string | undefined
): UseQueryResult<BillDetailResponseDto> {
  return useQuery({
    queryKey: ['bill', id],
    queryFn: () => billsApi.detail(id!),
    enabled: !!id,
  });
}
