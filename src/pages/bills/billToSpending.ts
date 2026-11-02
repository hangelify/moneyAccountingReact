import type { BillDetailResponseDto } from '@/types/bills';
import type {
  SpendingCategory,
  SpendingCurrency,
  SpendingSubCategory,
} from '@/types/dashboard';

const cents = (n: number): number => Math.round(n * 100) / 100;
const percent = (part: number, whole: number): number =>
  whole > 0 ? cents((part / whole) * 100) : 0;

/**
 * One bill's items in the dashboard's spending shape, so the sunburst can
 * draw it. Items carry only the category's name, so the name stands in for
 * its id. Shares are of the items' sum, which can differ from total_amount.
 * Largest first; Uncategorized always last.
 */
export function billToSpending(bill: BillDetailResponseDto): SpendingCurrency {
  const categories = new Map<
    string,
    { name: string; total: number; subs: Map<string, SpendingSubCategory> }
  >();
  let uncategorized = 0;
  let total = 0;

  for (const item of bill.items) {
    total += item.amount;
    const sub = item.sub_category;
    if (!sub) {
      uncategorized += item.amount;
      continue;
    }
    let category = categories.get(sub.category_name);
    if (!category) {
      category = { name: sub.category_name, total: 0, subs: new Map() };
      categories.set(sub.category_name, category);
    }
    category.total += item.amount;
    const row = category.subs.get(sub.id) ?? {
      id: sub.id,
      name: sub.name,
      total: 0,
      share_of_category: 0,
      lines: 0,
      archived: false,
    };
    row.total += item.amount;
    row.lines += 1;
    category.subs.set(sub.id, row);
  }

  const byTotal = (a: { total: number }, b: { total: number }): number =>
    b.total - a.total;

  const list: SpendingCategory[] = [...categories.values()]
    .sort(byTotal)
    .map((c) => ({
      // Prefixed so a category named "uncategorized" can't share its key.
      id: `name:${c.name}`,
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

  if (bill.items.some((i) => !i.sub_category)) {
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
