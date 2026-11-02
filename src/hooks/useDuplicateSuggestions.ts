import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { billsApi } from '@/pages/bills/api';
import type {
  DuplicateRange,
  DuplicateSuggestionsResponse,
} from '@/types/bills';

export const EMPTY_DUPLICATE_RANGE: DuplicateRange = {
  date_from: null,
  date_to: null,
};

export function useDuplicateSuggestions(
  range: DuplicateRange
): UseQueryResult<DuplicateSuggestionsResponse> {
  const hid = useActiveHouseholdId();
  return useQuery({
    // Under ['households', hid, 'bills'] so any bill change refreshes it.
    queryKey: ['households', hid, 'bills', 'duplicate-suggestions', range],
    queryFn: () => billsApi.duplicateSuggestions(hid!, range),
    enabled: hid !== null,
  });
}
