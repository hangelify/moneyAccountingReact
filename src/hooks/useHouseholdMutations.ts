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
import { ApiError } from '@/auth/apiError';
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

/** Resolves to true when the household was already gone (404). */
async function removeHousehold(hid: string): Promise<boolean> {
  try {
    await householdsApi.remove(hid);
    return false;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return true;
    throw error;
  }
}

/**
 * DELETE a household (variable is its id) and drop everything cached for it.
 * A 404 (deleted elsewhere, e.g. another tab) counts as done; the list is
 * refetched since the cached one was stale.
 */
export function useDeleteHousehold(): UseMutationResult<
  boolean,
  unknown,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeHousehold,
    meta: OWN_FORBIDDEN_META,
    onSuccess: (alreadyGone, hid) => {
      queryClient.setQueryData<Household[]>(HOUSEHOLDS_KEY, (list) =>
        list?.filter((h) => h.id !== hid)
      );
      queryClient.removeQueries({ queryKey: ['households', hid] });
      if (alreadyGone) {
        void queryClient.invalidateQueries({
          queryKey: HOUSEHOLDS_KEY,
          exact: true,
        });
      }
    },
  });
}
