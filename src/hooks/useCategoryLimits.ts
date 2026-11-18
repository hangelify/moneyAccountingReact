import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { categoryLimitsApi } from '@/api/categoryLimits';
import type {
  CategoryLimit,
  UpdateCategoryLimitRequest,
} from '@/types/categoryLimits';

/** Cache key of a household's limits; the HAN-29 report shares the prefix. */
export const categoryLimitsKey = (hid: string) =>
  ['households', hid, 'category-limits'] as const;

export interface SaveCategoryLimitVars {
  categoryId: string;
  /** The category has an open limit (`effective_to === null`): PUT, else POST. */
  hasOpenLimit: boolean;
  body: UpdateCategoryLimitRequest;
}

export function useCategoryLimitsQuery(
  hid: string
): UseQueryResult<CategoryLimit[]> {
  return useQuery({
    queryKey: categoryLimitsKey(hid),
    queryFn: () => categoryLimitsApi.list(hid),
  });
}

/** Puts the server's answer in place of the category's limit in the list. */
function storeLimit(
  client: QueryClient,
  hid: string,
  saved: CategoryLimit
): void {
  client.setQueryData<CategoryLimit[]>(categoryLimitsKey(hid), (list = []) =>
    list.some((l) => l.category_id === saved.category_id)
      ? list.map((l) => (l.category_id === saved.category_id ? saved : l))
      : [...list, saved]
  );
  // Marks the report (same prefix) stale without refetching this list.
  void client.invalidateQueries({
    queryKey: categoryLimitsKey(hid),
    refetchType: 'none',
  });
}

/** Refetches the limits (and the categories, after a 404) of `hid`. */
export function useRefreshCategoryLimits(
  hid: string
): (withCategories: boolean) => void {
  const client = useQueryClient();
  return (withCategories) => {
    void client.invalidateQueries({ queryKey: categoryLimitsKey(hid) });
    if (withCategories) {
      void client.invalidateQueries({
        queryKey: ['households', hid, 'categories'],
      });
    }
  };
}

export function useSaveCategoryLimit(
  hid: string
): UseMutationResult<CategoryLimit, unknown, SaveCategoryLimitVars> {
  const client = useQueryClient();
  return useMutation<CategoryLimit, unknown, SaveCategoryLimitVars>({
    mutationFn: ({ categoryId, hasOpenLimit, body }) =>
      hasOpenLimit
        ? categoryLimitsApi.update(hid, categoryId, body)
        : categoryLimitsApi.create(hid, { category_id: categoryId, ...body }),
    onSuccess: (saved) => {
      storeLimit(client, hid, saved);
    },
  });
}

export function useRemoveCategoryLimit(
  hid: string
): UseMutationResult<CategoryLimit, unknown, string> {
  const client = useQueryClient();
  return useMutation<CategoryLimit, unknown, string>({
    mutationFn: (categoryId) => categoryLimitsApi.remove(hid, categoryId),
    onSuccess: (saved) => {
      storeLimit(client, hid, saved);
    },
  });
}
