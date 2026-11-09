import { describe, it, expect } from 'vitest';
import type { BillEditItem, BillEdits } from '@/types/bills';
import {
  buildConfirmPayload,
  buildCreatePayload,
  hasMissingAmounts,
  receiptFieldErrors,
} from './buildConfirmPayload';

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
    fiscal_register_id: '',
    fiscal_receipt_number: '',
    purchase_time: '',
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

describe('hasMissingAmounts', () => {
  it('is false when the total and every line have amounts', () => {
    expect(hasMissingAmounts(makeEdits())).toBe(false);
  });

  it.each<[string, Partial<BillEdits>]>([
    ['an empty total', { total_amount: null }],
    ['an empty price', { items: [makeItem({ final_price: null })] }],
    ['an empty quantity', { items: [makeItem({ quantity: null })] }],
  ])('is true for %s', (_, patch) => {
    expect(hasMissingAmounts(makeEdits(patch))).toBe(true);
  });
});

describe.each([
  ['buildConfirmPayload', buildConfirmPayload],
  ['buildCreatePayload', buildCreatePayload],
])('%s with an empty field', (_, build) => {
  // An empty field must never reach the server as 0.
  it.each<[string, Partial<BillEdits>]>([
    ['total', { total_amount: null }],
    ['price', { items: [makeItem({ final_price: null })] }],
    ['quantity', { items: [makeItem({ quantity: null })] }],
  ])('throws for an empty %s', (_, patch) => {
    expect(() => build(makeEdits(patch), TODAY)).toThrow('missing amount');
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

const RECEIPT = {
  fiscal_register_id: ' J403 ',
  fiscal_receipt_number: '   ',
  purchase_time: '14:05',
};

describe.each([
  ['buildConfirmPayload', buildConfirmPayload],
  ['buildCreatePayload', buildCreatePayload],
] as const)('%s duplicate and receipt fields', (_name, build) => {
  it('adds duplicate_of_id when given', () => {
    expect(build(makeEdits(), TODAY, 'b0')).toMatchObject({
      duplicate_of_id: 'b0',
    });
    expect(build(makeEdits(), TODAY)).not.toHaveProperty('duplicate_of_id');
    expect(build(makeEdits(), TODAY, null)).not.toHaveProperty(
      'duplicate_of_id'
    );
  });

  it('sends trimmed receipt fields only when non-blank', () => {
    const body = build(makeEdits(RECEIPT), TODAY);
    expect(body).toMatchObject({
      fiscal_register_id: 'J403',
      purchase_time: '14:05',
    });
    expect(body).not.toHaveProperty('fiscal_receipt_number');
  });

  it('sends no receipt fields when all are empty', () => {
    const body = build(makeEdits(), TODAY);
    expect(body).not.toHaveProperty('fiscal_register_id');
    expect(body).not.toHaveProperty('fiscal_receipt_number');
    expect(body).not.toHaveProperty('purchase_time');
  });
});

describe('receiptFieldErrors', () => {
  const empty = {
    fiscal_register_id: '',
    fiscal_receipt_number: '',
    purchase_time: '',
  };

  it('accepts empty fields and a valid time', () => {
    expect(receiptFieldErrors(empty)).toEqual([]);
    expect(receiptFieldErrors({ ...empty, purchase_time: '23:59' })).toEqual(
      []
    );
  });

  it('rejects an id over 64 characters', () => {
    expect(
      receiptFieldErrors({ ...empty, fiscal_register_id: 'x'.repeat(65) })
    ).toEqual(['fiscal_register_id']);
    expect(
      receiptFieldErrors({ ...empty, fiscal_receipt_number: 'x'.repeat(64) })
    ).toEqual([]);
  });

  it('rejects a time that is not HH:MM', () => {
    expect(receiptFieldErrors({ ...empty, purchase_time: '25:00' })).toEqual([
      'purchase_time',
    ]);
    expect(receiptFieldErrors({ ...empty, purchase_time: '9:05' })).toEqual([
      'purchase_time',
    ]);
  });
});
