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
  CreateHouseholdRequest,
  Household,
  HouseholdResponse,
  UpdateMyHouseholdRequest,
} from '@/types/households';
import { mergeHouseholdResponse } from './mergeHouseholdResponse';

/** POST a household; the creator is its owner and it has no bills yet. */
export function useCreateHousehold(): UseMutationResult<
  HouseholdResponse,
  unknown,
  CreateHouseholdRequest
> {
  const queryClient = useQueryClient();
  return useMutation<HouseholdResponse, unknown, CreateHouseholdRequest>({
    mutationFn: (body) => householdsApi.create(body),
    meta: OWN_FORBIDDEN_META,
    onSuccess: (saved) => {
      queryClient.setQueryData<Household[]>(HOUSEHOLDS_KEY, (list) =>
        list ? [...list, { ...saved, role: 'owner', bill_count: 0 }] : list
      );
      void queryClient.invalidateQueries({
        queryKey: HOUSEHOLDS_KEY,
        exact: true,
      });
    },
  });
}

/** Rename the household for the current member only. */
export function useUpdateMyHouseholdName(
  hid: string
): UseMutationResult<HouseholdResponse, unknown, UpdateMyHouseholdRequest> {
  const queryClient = useQueryClient();
  return useMutation<HouseholdResponse, unknown, UpdateMyHouseholdRequest>({
    mutationFn: (body) => householdsApi.updateMine(hid, body),
    meta: OWN_FORBIDDEN_META,
    onSuccess: (saved) => {
      queryClient.setQueryData<Household[]>(HOUSEHOLDS_KEY, (list) =>
        mergeHouseholdResponse(list, saved)
      );
    },
  });
}

/** DELETE a household (variable is its id) and drop everything cached for it. */
export function useDeleteHousehold(): UseMutationResult<void, unknown, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hid: string) => householdsApi.remove(hid),
    meta: OWN_FORBIDDEN_META,
    onSuccess: (_data, hid) => {
      queryClient.setQueryData<Household[]>(HOUSEHOLDS_KEY, (list) =>
        list?.filter((h) => h.id !== hid)
      );
      queryClient.removeQueries({ queryKey: ['households', hid] });
    },
  });
}
