import { describe, it, expect } from 'vitest';
import type { BillDetailResponseDto, BillEdits } from '@/types/bills';
import { toConfirmItem } from './buildConfirmPayload';
import {
  billToEdits,
  buildDetailConfirmPayload,
  buildDetailUpdatePayload,
  isEditsValid,
} from './billDetailEdits';

function makeBill(
  overrides: Partial<BillDetailResponseDto> = {}
): BillDetailResponseDto {
  return {
    id: 'd1',
    bill_date: '2026-10-28',
    total_amount: 7.2,
    amount_mismatch: false,
    currency: 'EUR',
    description: 'Weekly groceries',
    created_at: '2026-10-28T10:00:00Z',
    status: 'draft',
    market: { id: 'm1', name: 'Lidl', city: null },
    items: [
      {
        id: 'l1',
        raw_name: 'MILK',
        sub_category: { id: 's1', name: 'Milk', category_name: 'Dairy' },
        product_count: 1,
        amount: 2.49,
        product_weight: null,
      },
      {
        id: 'l2',
        raw_name: 'APPLES',
        sub_category: null,
        product_count: 1,
        amount: 4.71,
        product_weight: 0.942,
      },
    ],
    ...overrides,
  };
}

const edited = (patch: Partial<BillEdits>, bill = makeBill()): BillEdits => ({
  ...billToEdits(bill),
  ...patch,
});

const withItemPrice = (index: number, finalPrice: number | null): BillEdits => {
  const edits = billToEdits(makeBill());
  edits.items = edits.items.map((item, i) =>
    i === index ? { ...item, final_price: finalPrice } : item
  );
  return edits;
};

describe('billToEdits', () => {
  it('maps a weighed line to kg with its price per kg', () => {
    expect(billToEdits(makeBill()).items[1]).toEqual({
      id: 'l2',
      name: 'APPLES',
      quantity: 1,
      unit: 'kg',
      weight_kg: 0.942,
      price_per_kg: 5,
      final_price: 4.71,
      sub_category: null,
      category: null,
      category_confidence: 1,
    });
  });

  it('keeps the line category the server sent', () => {
    const dairy = { id: 'c1', name: 'Dairy' };
    const bill = makeBill();
    const items = bill.items.map((i) => ({ ...i, category: dairy }));
    expect(
      billToEdits({ ...bill, items }).items.map((i) => i.category)
    ).toEqual([dairy, dairy]);
  });

  it('maps a line without weight to a piece', () => {
    const item = billToEdits(makeBill()).items[0];
    expect(item).toMatchObject({
      id: 'l1',
      name: 'MILK',
      unit: 'piece',
      weight_kg: null,
      price_per_kg: null,
      final_price: 2.49,
    });
  });

  it('slices the date and defaults the receipt fields', () => {
    const edits = billToEdits(makeBill({ bill_date: '2026-10-28T00:00:00Z' }));
    expect(edits).toMatchObject({
      market_name: 'Lidl',
      bill_date: '2026-10-28',
      currency: 'EUR',
      total_amount: 7.2,
      fiscal_register_id: '',
      fiscal_receipt_number: '',
      purchase_time: '',
    });
  });

  it('keeps receipt fields the bill has', () => {
    const edits = billToEdits(
      makeBill({ fiscal_register_id: 'R1', purchase_time: '10:15' })
    );
    expect(edits.fiscal_register_id).toBe('R1');
    expect(edits.purchase_time).toBe('10:15');
  });

  it('falls back to the raw market name, then to empty', () => {
    expect(
      billToEdits(makeBill({ market: null, market_name_raw: 'N-1' }))
        .market_name
    ).toBe('N-1');
    expect(billToEdits(makeBill({ market: null })).market_name).toBe('');
    expect(billToEdits(makeBill({ currency: null })).currency).toBe('');
  });
});

describe('isEditsValid', () => {
  it('accepts the loaded bill', () => {
    expect(isEditsValid(billToEdits(makeBill()))).toBe(true);
  });

  it.each<[string, Partial<BillEdits>]>([
    ['no items', { items: [] }],
    ['a zero total', { total_amount: 0 }],
    ['an empty total', { total_amount: null }],
    ['no date', { bill_date: '' }],
    ['a bad purchase time', { purchase_time: '25:00' }],
  ])('rejects %s', (_, patch) => {
    expect(isEditsValid(edited(patch))).toBe(false);
  });

  it('rejects a new line with neither a name nor a category', () => {
    const edits = billToEdits(makeBill());
    edits.items = [
      ...edits.items,
      {
        name: '  ',
        quantity: 1,
        unit: 'piece',
        weight_kg: null,
        price_per_kg: null,
        final_price: 1.5,
        sub_category: null,
        category: null,
        category_confidence: 1,
      },
    ];
    expect(isEditsValid(edits)).toBe(false);
    edits.items[2] = { ...edits.items[2]!, name: 'BREAD' };
    expect(isEditsValid(edits)).toBe(true);
  });

  it('accepts a new line with only a category', () => {
    const edits = billToEdits(makeBill());
    edits.items = [
      ...edits.items,
      {
        name: '',
        quantity: 1,
        unit: 'piece',
        weight_kg: null,
        price_per_kg: null,
        final_price: 1.5,
        sub_category: null,
        category: { id: 'c1', name: 'Dairy' },
        category_confidence: 1,
      },
    ];
    expect(isEditsValid(edits)).toBe(true);
  });

  it('rejects a line with a non-positive price, like a fresh empty row', () => {
    expect(isEditsValid(withItemPrice(1, 0))).toBe(false);
  });

  it('rejects a line with an empty price or quantity', () => {
    expect(isEditsValid(withItemPrice(1, null))).toBe(false);
    const edits = billToEdits(makeBill());
    edits.items[0] = { ...edits.items[0]!, quantity: null };
    expect(isEditsValid(edits)).toBe(false);
  });
});

describe('buildDetailConfirmPayload', () => {
  it('links the known market and sends the lines with their names', () => {
    const body = buildDetailConfirmPayload(makeBill(), billToEdits(makeBill()));
    expect(body.market_id).toBe('m1');
    expect(body).not.toHaveProperty('new_market');
    expect(body.currency).toBe('EUR');
    expect(body.items[0]).toEqual({
      id: 'l1',
      sub_category_id: 's1',
      raw_name: 'MILK',
      product_count: 1,
      amount: 2.49,
    });
    expect(body).not.toHaveProperty('duplicate_of_id');
  });

  it('sends new_market when the market was renamed', () => {
    const body = buildDetailConfirmPayload(
      makeBill(),
      edited({ market_name: 'Kaufland' })
    );
    expect(body.new_market).toEqual({ name: 'Kaufland' });
    expect(body).not.toHaveProperty('market_id');
  });

  it('sends no market when the name was cleared', () => {
    const body = buildDetailConfirmPayload(
      makeBill(),
      edited({ market_name: '' })
    );
    expect(body).not.toHaveProperty('market_id');
    expect(body).not.toHaveProperty('new_market');
  });

  it('adds duplicate_of_id when given', () => {
    const body = buildDetailConfirmPayload(
      makeBill(),
      billToEdits(makeBill()),
      'orig-1'
    );
    expect(body.duplicate_of_id).toBe('orig-1');
  });
});

describe('buildDetailUpdatePayload', () => {
  it('sends nothing when nothing changed', () => {
    expect(
      buildDetailUpdatePayload(makeBill(), billToEdits(makeBill()))
    ).toEqual({});
  });

  it('ignores a price that rounds to the same value', () => {
    expect(
      buildDetailUpdatePayload(makeBill(), withItemPrice(0, 2.49 + 1e-9))
    ).toEqual({});
  });

  it.each<[string, Partial<BillEdits>, object]>([
    ['the total', { total_amount: 9 }, { total_amount: 9 }],
    ['the currency', { currency: 'USD' }, { currency: 'USD' }],
    [
      'a receipt field',
      { fiscal_receipt_number: '42' },
      { fiscal_receipt_number: '42' },
    ],
    ['the date', { bill_date: '2026-10-29' }, { bill_date: '2026-10-29' }],
    [
      'the market name',
      { market_name: 'Kaufland' },
      { new_market: { name: 'Kaufland' } },
    ],
  ])('sends only %s when it changed', (_, patch, expected) => {
    expect(buildDetailUpdatePayload(makeBill(), edited(patch))).toEqual(
      expected
    );
  });

  it('leaves out a cleared market and a cleared receipt field', () => {
    const bill = makeBill({ fiscal_register_id: 'R1' });
    expect(
      buildDetailUpdatePayload(
        bill,
        edited({ market_name: '', fiscal_register_id: '' }, bill)
      )
    ).toEqual({});
  });

  it('sends the remaining lines with their own ids after a removal', () => {
    const edits = billToEdits(makeBill());
    edits.items = edits.items.slice(1);
    const body = buildDetailUpdatePayload(makeBill(), edits);
    expect(body.items).toEqual(edits.items.map(toConfirmItem));
    expect(body.items?.[0]?.id).toBe('l2');
  });

  it('sends category_id alone when a sub-category becomes its category', () => {
    const bill = makeBill();
    bill.items[0] = {
      ...bill.items[0]!,
      category: { id: 'c1', name: 'Dairy' },
    };
    const edits = billToEdits(bill);
    edits.items[0] = { ...edits.items[0]!, sub_category: null };
    const body = buildDetailUpdatePayload(bill, edits);
    expect(body.items?.[0]).toMatchObject({ id: 'l1', category_id: 'c1' });
    expect(body.items?.[0]).not.toHaveProperty('sub_category_id');
  });

  it('sends an added line without an id', () => {
    const edits = billToEdits(makeBill());
    edits.items = [
      ...edits.items,
      {
        name: 'BREAD',
        quantity: 1,
        unit: 'piece',
        weight_kg: null,
        price_per_kg: null,
        final_price: 1.5,
        sub_category: null,
        category: null,
        category_confidence: 1,
      },
    ];
    const body = buildDetailUpdatePayload(makeBill(), edits);
    expect(body.items).toHaveLength(3);
    expect(body.items?.[2]).toEqual({
      raw_name: 'BREAD',
      product_count: 1,
      amount: 1.5,
    });
  });
});
