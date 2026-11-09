import { describe, it, expect } from 'vitest';
import type { BillDetailItem, BillDetailResponseDto } from '@/types/bills';
import { billToSpending } from './billToSpending';

let n = 0;
function item(
  amount: number,
  sub: { id: string; name: string; category_name: string } | null,
  category?: { id: string; name: string } | null
): BillDetailItem {
  n += 1;
  return {
    id: `l${n}`,
    raw_name: `ITEM ${n}`,
    sub_category: sub,
    ...(category !== undefined ? { category } : {}),
    product_count: 1,
    amount,
    product_weight: null,
  };
}

function bill(items: BillDetailItem[]): BillDetailResponseDto {
  return {
    id: 'b1',
    bill_date: '2026-10-28',
    total_amount: 99,
    amount_mismatch: true,
    currency: 'EUR',
    created_at: '2026-10-28T10:00:00Z',
    items,
  };
}

const milk = { id: 's1', name: 'milk', category_name: 'Dairy' };
const cheese = { id: 's2', name: 'cheese', category_name: 'Dairy' };
const bread = { id: 's3', name: 'bread', category_name: 'Bakery' };

describe('billToSpending', () => {
  it('groups items by category, then sub-category', () => {
    const data = billToSpending(
      bill([item(2, milk), item(3, cheese), item(1, milk), item(4, bread)])
    );
    expect(data.currency).toBe('EUR');
    expect(data.total).toBe(10);
    expect(data.lines).toBe(4);
    expect(data.categories.map((c) => [c.name, c.total])).toEqual([
      ['Dairy', 6],
      ['Bakery', 4],
    ]);
    const dairy = data.categories[0];
    expect(dairy?.sub_categories.map((s) => [s.id, s.total, s.lines])).toEqual([
      ['s1', 3, 2],
      ['s2', 3, 1],
    ]);
  });

  it('puts items without a sub-category in a last Uncategorized bucket', () => {
    const data = billToSpending(bill([item(1, milk), item(5, null)]));
    const last = data.categories.at(-1);
    expect(last?.id).toBeNull();
    expect(last?.total).toBe(5);
    expect(last?.sub_categories).toEqual([]);
  });

  it('works out shares from the items, not the bill total', () => {
    const data = billToSpending(
      bill([item(1, milk), item(1, cheese), item(2, bread)])
    );
    expect(data.categories.map((c) => c.share)).toEqual([50, 50]);
    const dairy = data.categories.find((c) => c.name === 'Dairy');
    expect(dairy?.sub_categories.map((s) => s.share_of_category)).toEqual([
      50, 50,
    ]);
  });

  it('rounds sums to cents', () => {
    const data = billToSpending(bill([item(0.1, milk), item(0.2, milk)]));
    expect(data.total).toBe(0.3);
    expect(data.categories[0]?.total).toBe(0.3);
  });

  it('keeps a category named like the Uncategorized key apart from it', () => {
    const odd = { id: 's9', name: 'x', category_name: 'uncategorized' };
    const data = billToSpending(bill([item(1, odd), item(1, null)]));
    expect(data.categories).toHaveLength(2);
    expect(data.categories[0]?.id).not.toBeNull();
  });

  it('returns no categories for a bill without items', () => {
    const data = billToSpending(bill([]));
    expect(data.total).toBe(0);
    expect(data.categories).toEqual([]);
  });

  it('keeps a missing currency as null', () => {
    const data = billToSpending({ ...bill([item(1, milk)]), currency: null });
    expect(data.currency).toBeNull();
  });

  describe('with the line category', () => {
    const dairy = { id: 'c1', name: 'Dairy' };

    it('counts a line without a sub-category in its category', () => {
      const data = billToSpending(
        bill([item(2, milk, dairy), item(3, null, dairy), item(1, null, null)])
      );
      expect(data.categories.map((c) => [c.id, c.name, c.total])).toEqual([
        ['c1', 'Dairy', 5],
        [null, 'Uncategorized', 1],
      ]);
      const subs = data.categories[0]?.sub_categories;
      expect(subs?.map((s) => [s.id, s.name, s.total, s.lines])).toEqual([
        ['s1', 'milk', 2, 1],
        // Like the API: id null and last, even when it is the largest.
        [null, 'No sub-category', 3, 1],
      ]);
    });

    it('groups by category id, not name', () => {
      const other = { id: 'c2', name: 'Dairy' };
      const data = billToSpending(
        bill([item(1, null, dairy), item(1, null, other)])
      );
      expect(data.categories.map((c) => c.id)).toEqual(['c1', 'c2']);
    });

    it('leaves Uncategorized out when every line has a category', () => {
      const data = billToSpending(bill([item(1, null, dairy)]));
      expect(data.categories.map((c) => c.id)).toEqual(['c1']);
    });
  });
});
