import { describe, it, expect } from 'vitest';
import type { BillDetailResponseDto } from '@/types/bills';
import {
  buildDetailConfirmPayload,
  isDraftValid,
  toDraft,
} from './billDetailDraft';

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

describe('toDraft', () => {
  it('keeps the line ids and slices the date', () => {
    const draft = toDraft(makeBill({ bill_date: '2026-10-28T00:00:00Z' }));
    expect(draft.date).toBe('2026-10-28');
    expect(draft.items.map((i) => i.id)).toEqual(['l1', 'l2']);
  });

  it('falls back to the raw market name when there is no market', () => {
    const draft = toDraft(
      makeBill({ market: null, market_name_raw: 'N-1 Supermarket' })
    );
    expect(draft.market).toBe('N-1 Supermarket');
  });
});

describe('buildDetailConfirmPayload', () => {
  it('sends the unedited bill with market_id and only known fields', () => {
    const bill = makeBill();
    expect(buildDetailConfirmPayload(bill, toDraft(bill))).toEqual({
      market_id: 'm1',
      bill_date: '2026-10-28',
      total_amount: 7.2,
      items: [
        { id: 'l1', sub_category_id: 's1', product_count: 1, amount: 2.49 },
        { id: 'l2', product_count: 1, amount: 4.71, product_weight: 0.942 },
      ],
    });
  });

  it('applies edited values and rounds them', () => {
    const bill = makeBill();
    const draft = toDraft(bill);
    draft.date = '2026-10-27';
    draft.total = '10.199';
    draft.items[0] = {
      ...draft.items[0]!,
      subCategory: { id: 's2', name: 'Cheese', category_name: 'Dairy' },
      amount: '3.456',
      count: '2.4',
    };
    draft.items[1] = { ...draft.items[1]!, weight: '1.23456' };
    const body = buildDetailConfirmPayload(bill, draft);
    expect(body.bill_date).toBe('2026-10-27');
    expect(body.total_amount).toBe(10.2);
    expect(body.items[0]).toEqual({
      id: 'l1',
      sub_category_id: 's2',
      product_count: 2,
      amount: 3.46,
    });
    expect(body.items[1]?.product_weight).toBe(1.235);
  });

  it('omits product_weight and sub_category_id when cleared', () => {
    const bill = makeBill();
    const draft = toDraft(bill);
    draft.items[0] = { ...draft.items[0]!, subCategory: null };
    draft.items[1] = { ...draft.items[1]!, weight: '' };
    const body = buildDetailConfirmPayload(bill, draft);
    expect(body.items[0]).not.toHaveProperty('sub_category_id');
    expect(body.items[1]).not.toHaveProperty('product_weight');
  });

  it('clamps product_count to at least 1', () => {
    const bill = makeBill();
    const draft = toDraft(bill);
    draft.items[0] = { ...draft.items[0]!, count: '0' };
    expect(buildDetailConfirmPayload(bill, draft).items[0]?.product_count).toBe(
      1
    );
  });

  it('sends new_market when the market name was changed', () => {
    const bill = makeBill();
    const draft = { ...toDraft(bill), market: '  Kaufland ' };
    const body = buildDetailConfirmPayload(bill, draft);
    expect(body).not.toHaveProperty('market_id');
    expect(body.new_market).toEqual({ name: 'Kaufland' });
  });

  it('sends new_market for a draft that only has a raw market name', () => {
    const bill = makeBill({ market: null, market_name_raw: 'N-1' });
    const body = buildDetailConfirmPayload(bill, toDraft(bill));
    expect(body.new_market).toEqual({ name: 'N-1' });
  });

  it('sends no market when the name was cleared', () => {
    const bill = makeBill();
    const body = buildDetailConfirmPayload(bill, {
      ...toDraft(bill),
      market: ' ',
    });
    expect(body).not.toHaveProperty('market_id');
    expect(body).not.toHaveProperty('new_market');
  });

  it('omits the id of a line the backend did not return one for', () => {
    const bill = makeBill();
    const draft = toDraft(bill);
    draft.items[0] = { ...draft.items[0]!, id: undefined };
    expect(buildDetailConfirmPayload(bill, draft).items[0]).not.toHaveProperty(
      'id'
    );
  });
});

describe('isDraftValid', () => {
  const bill = makeBill();

  it('accepts the loaded bill', () => {
    expect(isDraftValid(toDraft(bill))).toBe(true);
  });

  it.each([
    ['empty date', { date: '' }],
    ['zero total', { total: '0' }],
    ['blank total', { total: '' }],
  ])('rejects %s', (_, patch) => {
    expect(isDraftValid({ ...toDraft(bill), ...patch })).toBe(false);
  });

  it('rejects a line with a non-positive amount', () => {
    const draft = toDraft(bill);
    draft.items[0] = { ...draft.items[0]!, amount: '0' };
    expect(isDraftValid(draft)).toBe(false);
  });

  it('rejects a bill with no lines', () => {
    expect(isDraftValid({ ...toDraft(bill), items: [] })).toBe(false);
  });
});
