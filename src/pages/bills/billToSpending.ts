import type { BillDetailResponseDto } from '@/types/bills';
import type {
  SpendingCategory,
  SpendingCurrency,
  SpendingSubCategory,
} from '@/types/dashboard';
import { lineCategory } from './lineCategory';

const cents = (n: number): number => Math.round(n * 100) / 100;
const percent = (part: number, whole: number): number =>
  whole > 0 ? cents((part / whole) * 100) : 0;

/**
 * One bill's items in the dashboard's spending shape, so the sunburst can
 * draw it. Items are grouped by their category's id; older responses carry
 * only its name, which then stands in for the id. A line with a category but
 * no sub-category goes to that category's "no sub-category" slice. Shares
 * are of the items' sum, which can differ from total_amount. Largest first;
 * Uncategorized always last.
 */
export function billToSpending(
  bill: BillDetailResponseDto,
  noSubCategoryName = 'No sub-category'
): SpendingCurrency {
  const categories = new Map<
    string,
    { name: string; total: number; subs: Map<string, SpendingSubCategory> }
  >();
  let uncategorized = 0;
  let total = 0;

  for (const item of bill.items) {
    total += item.amount;
    const line = lineCategory(item);
    if (!line) {
      uncategorized += item.amount;
      continue;
    }
    let category = categories.get(line.key);
    if (!category) {
      category = { name: line.name, total: 0, subs: new Map() };
      categories.set(line.key, category);
    }
    category.total += item.amount;
    const sub = item.sub_category;
    // Prefixed so it can't share a key with a real sub-category.
    const subId = sub ? sub.id : `none:${line.key}`;
    const row = category.subs.get(subId) ?? {
      id: subId,
      name: sub ? sub.name : noSubCategoryName,
      total: 0,
      share_of_category: 0,
      lines: 0,
      archived: false,
    };
    row.total += item.amount;
    row.lines += 1;
    category.subs.set(subId, row);
  }

  const byTotal = (a: { total: number }, b: { total: number }): number =>
    b.total - a.total;

  const list: SpendingCategory[] = [...categories.entries()]
    .map(([id, c]) => ({ id, ...c }))
    .sort(byTotal)
    .map((c) => ({
      id: c.id,
      name: c.name,
      total: cents(c.total),
      share: percent(c.total, total),
      archived: false,
      sub_categories: [...c.subs.values()].sort(byTotal).map((s) => ({
        ...s,
        total: cents(s.total),
        share_of_category: percent(s.total, c.total),
      })),
    }));

  if (bill.items.some((i) => !lineCategory(i))) {
    list.push({
      id: null,
      name: 'Uncategorized',
      total: cents(uncategorized),
      share: percent(uncategorized, total),
      archived: false,
      sub_categories: [],
    });
  }

  return {
    currency: bill.currency ?? null,
    total: cents(total),
    lines: bill.items.length,
    categories: list,
  };
}
