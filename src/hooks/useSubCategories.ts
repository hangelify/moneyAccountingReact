import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subCategoriesApi } from '@/pages/categories/api';
import type { SubCategoryResponse } from '@/types/categories';

export interface SubCategoryGroup {
  categoryName: string;
  items: SubCategoryResponse[];
}

export interface UseSubCategoriesResult {
  status: 'pending' | 'success' | 'error';
  groups: SubCategoryGroup[];
  refetch: () => void;
  byId: Map<string, SubCategoryResponse>;
}

export function useSubCategories(): UseSubCategoriesResult {
  const query = useQuery({
    queryKey: ['sub-categories'],
    queryFn: subCategoriesApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const { groups, byId } = useMemo(() => {
    const list = query.data ?? [];
    const byCategory = new Map<string, SubCategoryResponse[]>();
    for (const sc of list) {
      const arr = byCategory.get(sc.category_name) ?? [];
      arr.push(sc);
      byCategory.set(sc.category_name, arr);
    }
    const groups: SubCategoryGroup[] = [...byCategory.entries()]
      .map(([categoryName, items]) => ({
        categoryName,
        items: items.slice().sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));

    const byId = new Map(list.map((sc) => [sc.id, sc]));
    return { groups, byId };
  }, [query.data]);

  return {
    status: query.status,
    groups,
    byId,
    refetch: () => {
      void query.refetch();
    },
  };
}
