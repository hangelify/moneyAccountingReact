import type { CategoryResponse, SubCategoryResponse } from '@/types/categories';

export interface CategoryNode {
  id: string;
  name: string;
  subs: { id: string; name: string }[];
}

const byName = (a: { name: string }, b: { name: string }): number =>
  a.name.localeCompare(b.name);

/**
 * Categories with their sub-categories, both sorted by name. A category with
 * no sub-categories is kept; a sub-category whose category isn't listed is
 * dropped.
 */
export function buildCategoryTree(
  categories: CategoryResponse[],
  subCategories: SubCategoryResponse[]
): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(
    categories.map((c) => [c.id, { id: c.id, name: c.name, subs: [] }])
  );
  for (const sc of subCategories) {
    nodes.get(sc.category_id)?.subs.push({ id: sc.id, name: sc.name });
  }
  const tree = [...nodes.values()].sort(byName);
  for (const node of tree) node.subs.sort(byName);
  return tree;
}

/**
 * A matching category keeps all its sub-categories; otherwise a category
 * keeps only the sub-categories that match, and is dropped without any.
 */
export function filterTree(
  tree: CategoryNode[],
  query: string
): CategoryNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return tree;
  const matches = (name: string): boolean => name.toLowerCase().includes(q);
  return tree.flatMap((node) => {
    if (matches(node.name)) return [node];
    const subs = node.subs.filter((s) => matches(s.name));
    return subs.length ? [{ ...node, subs }] : [];
  });
}
