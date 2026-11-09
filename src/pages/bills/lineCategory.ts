import type { CategoryRef, SubCategoryRef } from '@/types/bills';

interface LineLike {
  sub_category: SubCategoryRef | null;
  // Absent on responses from before the API sent it.
  category?: CategoryRef | null | undefined;
}

/**
 * A line's category. Older responses carry only the sub-category's
 * category name, so the key is the id when known, else the prefixed name.
 */
export function lineCategory(
  item: LineLike
): { key: string; name: string } | null {
  if (item.category) return { key: item.category.id, name: item.category.name };
  if (item.sub_category) {
    const name = item.sub_category.category_name;
    return { key: `name:${name}`, name };
  }
  return null;
}

/** "Category › Sub-category", "Category", or null when there's neither. */
export function formatLineCategory(item: LineLike): string | null {
  const category = lineCategory(item);
  if (!category) return null;
  return item.sub_category
    ? `${category.name} › ${item.sub_category.name}`
    : category.name;
}
