import type { CategoryLimit } from '@/types/categoryLimits';
import type { CategoryResponse } from '@/types/categories';

type LimitRowState = 'none' | 'active' | 'ending' | 'archived';

export interface LimitRowModel {
  categoryId: string;
  name: string;
  limit: CategoryLimit | null;
  state: LimitRowState;
  /** The limit is kept in another currency than the budget's. */
  otherCurrency: boolean;
}

const GROUP: Record<LimitRowState, number> = {
  active: 0,
  ending: 0,
  none: 1,
  archived: 2,
};

function stateOf(limit: CategoryLimit | null): LimitRowState {
  if (limit === null) return 'none';
  if (limit.category_archived) return 'archived';
  return limit.effective_to === null ? 'active' : 'ending';
}

/**
 * One row per category of the budget, plus rows for limits of deleted
 * categories that are still in force. Limited first, then unlimited, then
 * archived; by name inside each group.
 */
export function buildLimitRows(
  categories: CategoryResponse[],
  limits: CategoryLimit[],
  householdCurrency: string
): LimitRowModel[] {
  const byCategory = new Map(limits.map((l) => [l.category_id, l]));
  const row = (
    categoryId: string,
    name: string,
    limit: CategoryLimit | null
  ): LimitRowModel => ({
    categoryId,
    name,
    limit,
    state: stateOf(limit),
    otherCurrency: limit !== null && limit.currency !== householdCurrency,
  });
  const known = new Set(categories.map((c) => c.id));
  const rows = [
    ...categories.map((c) => row(c.id, c.name, byCategory.get(c.id) ?? null)),
    ...limits
      .filter((l) => !known.has(l.category_id))
      .map((l) =>
        row(l.category_id, l.category_name, { ...l, category_archived: true })
      ),
  ];
  return rows.sort(
    (a, b) =>
      GROUP[a.state] - GROUP[b.state] ||
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}
