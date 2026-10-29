import { describe, it, expect } from 'vitest';
import type { BillEditItem, BillEdits } from '@/types/bills';
import { buildConfirmPayload, buildCreatePayload } from './buildConfirmPayload';

const TODAY = '2026-10-29';

function makeItem(overrides: Partial<BillEditItem> = {}): BillEditItem {
  return {
    id: 'l1',
    name: 'BREAD',
    quantity: 1,
    unit: 'piece',
    weight_kg: null,
    price_per_kg: null,
    final_price: 1.2,
    sub_category: { id: 's1', name: 'Bakery', category_name: 'Food' },
    category_confidence: 0.9,
    ...overrides,
  };
}

function makeEdits(overrides: Partial<BillEdits> = {}): BillEdits {
  return {
    market_name: 'Lidl',
    bill_date: '2026-05-07',
    currency: 'EUR',
    total_amount: 10,
    items: [makeItem()],
    ...overrides,
  };
}

describe('buildConfirmPayload', () => {
  it('maps an item to the confirm shape without product_weight', () => {
    const { items } = buildConfirmPayload(makeEdits(), TODAY);
    expect(items).toEqual([
      {
        id: 'l1',
        sub_category_id: 's1',
        raw_name: 'BREAD',
        product_count: 1,
        amount: 1.2,
      },
    ]);
    expect(items[0]).not.toHaveProperty('product_weight');
  });

  it('turns quantity 0 into 1 and rounds 2.6 to 3', () => {
    const { items } = buildConfirmPayload(
      makeEdits({
        items: [makeItem({ quantity: 0 }), makeItem({ quantity: 2.6 })],
      }),
      TODAY
    );
    expect(items.map((i) => i.product_count)).toEqual([1, 3]);
  });

  it('rounds amount to 2 decimals and weight to 3', () => {
    const { items } = buildConfirmPayload(
      makeEdits({
        items: [makeItem({ final_price: 8.987, weight_kg: 1.23456 })],
      }),
      TODAY
    );
    expect(items[0]!.amount).toBe(8.99);
    expect(items[0]!.product_weight).toBe(1.235);
  });

  it('leaves out sub_category_id and raw_name when absent', () => {
    const { items } = buildConfirmPayload(
      makeEdits({ items: [makeItem({ sub_category: null, name: '' })] }),
      TODAY
    );
    expect(items[0]).not.toHaveProperty('sub_category_id');
    expect(items[0]).not.toHaveProperty('raw_name');
  });

  it('omits id for lines without one', () => {
    const { id: _id, ...noId } = makeItem();
    const { items } = buildConfirmPayload(makeEdits({ items: [noId] }), TODAY);
    expect(items[0]).not.toHaveProperty('id');
  });

  it('builds new_market from the market name, or omits it when empty', () => {
    expect(buildConfirmPayload(makeEdits(), TODAY).new_market).toEqual({
      name: 'Lidl',
    });
    expect(
      buildConfirmPayload(makeEdits({ market_name: '' }), TODAY)
    ).not.toHaveProperty('new_market');
  });

  it('defaults an empty bill_date to today and omits an empty currency', () => {
    const p = buildConfirmPayload(
      makeEdits({ bill_date: '', currency: '' }),
      TODAY
    );
    expect(p.bill_date).toBe(TODAY);
    expect(p).not.toHaveProperty('currency');
  });

  it('rounds total_amount to 2 decimals', () => {
    expect(
      buildConfirmPayload(makeEdits({ total_amount: 10.194 }), TODAY)
        .total_amount
    ).toBe(10.19);
  });
});

describe('buildCreatePayload', () => {
  it('has no id, raw_name or new_market keys', () => {
    const p = buildCreatePayload(makeEdits(), TODAY);
    expect(p).not.toHaveProperty('new_market');
    expect(p.items[0]).toEqual({
      sub_category_id: 's1',
      product_count: 1,
      amount: 1.2,
    });
  });

  it('throws when a line has no sub-category', () => {
    expect(() =>
      buildCreatePayload(
        makeEdits({ items: [makeItem({ sub_category: null })] }),
        TODAY
      )
    ).toThrow('uncategorised');
  });
});
