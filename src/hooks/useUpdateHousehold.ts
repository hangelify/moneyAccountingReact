import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  HOUSEHOLDS_KEY,
  OWN_FORBIDDEN_META,
} from '@/contexts/HouseholdContext';
import { householdsApi } from '@/api/households';
import type {
  Household,
  HouseholdResponse,
  UpdateHouseholdRequest,
} from '@/types/households';
import { mergeHouseholdResponse } from './mergeHouseholdResponse';

/**
 * PUT the household. Converted amounts depend on its currency, so every
 * household-scoped query (bills, bill detail, dashboard) is refetched.
 */
export function useUpdateHousehold(
  hid: string
): UseMutationResult<HouseholdResponse, unknown, UpdateHouseholdRequest> {
  const queryClient = useQueryClient();
  return useMutation<HouseholdResponse, unknown, UpdateHouseholdRequest>({
    mutationFn: (body) => householdsApi.update(hid, body),
    meta: OWN_FORBIDDEN_META,
    onSuccess: (saved) => {
      queryClient.setQueryData<Household[]>(HOUSEHOLDS_KEY, (list) =>
        mergeHouseholdResponse(list, saved)
      );
      void queryClient.invalidateQueries({ queryKey: ['households', hid] });
    },
  });
}
