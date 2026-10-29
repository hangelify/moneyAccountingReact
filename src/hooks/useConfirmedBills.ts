import {
  keepPreviousData,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { billsApi } from '@/pages/bills/api';
import type { ConfirmedBillsFilters } from '@/pages/bills/buildBillsQueryParams';
import type { Paginated } from '@/types/pagination';
import type { BillResponseDto } from '@/types/bills';

export function useConfirmedBills(
  filters: ConfirmedBillsFilters,
  page: number,
  limit: number
): UseQueryResult<Paginated<BillResponseDto>> {
  return useQuery({
    queryKey: ['confirmedBills', filters, page, limit],
    queryFn: () => billsApi.list(filters, page, limit),
    placeholderData: keepPreviousData,
  });
}
