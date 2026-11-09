import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { categoriesApi, subCategoriesApi } from '@/pages/categories/api';
import { buildCategoryTree } from './categoryTree';
import type { CategoryNode } from './categoryTree';

export interface UseCategoryTreeResult {
  status: 'pending' | 'success' | 'error';
  tree: CategoryNode[];
  refetch: () => void;
}

const STALE_TIME = 5 * 60 * 1000;

/** The household's categories with their sub-categories, for picking. */
export function useCategoryTree(): UseCategoryTreeResult {
  const hid = useActiveHouseholdId();
  const categories = useQuery({
    queryKey: ['households', hid, 'categories'],
    queryFn: () => categoriesApi.list(hid!),
    enabled: hid !== null,
    staleTime: STALE_TIME,
  });
  const subCategories = useQuery({
    queryKey: ['households', hid, 'sub-categories'],
    queryFn: () => subCategoriesApi.list(hid!),
    enabled: hid !== null,
    staleTime: STALE_TIME,
  });

  const tree = useMemo(
    () =>
      categories.data && subCategories.data
        ? buildCategoryTree(categories.data, subCategories.data)
        : [],
    [categories.data, subCategories.data]
  );

  const queries = [categories, subCategories];
  const failed = queries.filter((q) => q.isError);
  const status =
    failed.length > 0
      ? 'error'
      : queries.some((q) => q.isPending)
        ? 'pending'
        : 'success';

  return {
    status,
    tree,
    refetch: () => {
      for (const q of failed.length > 0 ? failed : queries) void q.refetch();
    },
  };
}
