import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  HOUSEHOLDS_KEY,
  OWN_FORBIDDEN_META,
} from '@/contexts/HouseholdContext';
import { householdsApi } from '@/pages/households/api';
import type { Household, UpdateHouseholdRequest } from '@/types/households';

/**
 * PUT the household. Converted amounts depend on its currency, so every
 * household-scoped query (bills, bill detail, dashboard) is refetched.
 */
export function useUpdateHousehold(
  hid: string
): UseMutationResult<Household, unknown, UpdateHouseholdRequest> {
  const queryClient = useQueryClient();
  return useMutation<Household, unknown, UpdateHouseholdRequest>({
    mutationFn: (body) => householdsApi.update(hid, body),
    meta: OWN_FORBIDDEN_META,
    onSuccess: (saved) => {
      queryClient.setQueryData<Household[]>(HOUSEHOLDS_KEY, (list) =>
        list?.map((h) => (h.id === saved.id ? saved : h))
      );
      void queryClient.invalidateQueries({ queryKey: ['households', hid] });
    },
  });
}
