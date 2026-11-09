import type { Currency } from '@/const/currency';
import type {
  BillDetailResponseDto,
  BillEditItem,
  BillEdits,
  ConfirmBillRequest,
  UpdateBillRequest,
} from '@/types/bills';
import {
  buildConfirmPayload,
  hasMissingAmounts,
  receiptFieldErrors,
  requireAmount,
  toConfirmItem,
  todayIso,
} from './buildConfirmPayload';

const round2 = (x: number): number => Math.round(x * 100) / 100;

const RECEIPT_FIELDS = [
  'fiscal_register_id',
  'fiscal_receipt_number',
  'purchase_time',
] as const;

/** The review form's state for a loaded bill. */
export function billToEdits(bill: BillDetailResponseDto): BillEdits {
  return {
    market_name: bill.market?.name ?? bill.market_name_raw ?? '',
    bill_date: bill.bill_date.slice(0, 10),
    currency: bill.currency ?? '',
    total_amount: bill.total_amount,
    // Unit and price per kg only help with entry; the API keeps neither.
    items: bill.items.map((item): BillEditItem => {
      const weight = item.product_weight ?? null;
      return {
        id: item.id,
        name: item.raw_name,
        quantity: item.product_count,
        unit: weight ? 'kg' : 'piece',
        weight_kg: weight,
        price_per_kg: weight ? round2(item.amount / weight) : null,
        final_price: item.amount,
        sub_category: item.sub_category,
        category: item.category ?? null,
        category_confidence: 1,
      };
    }),
    fiscal_register_id: bill.fiscal_register_id ?? '',
    fiscal_receipt_number: bill.fiscal_receipt_number ?? '',
    purchase_time: bill.purchase_time ?? '',
  };
}

/** Whether the edits satisfy the confirm and update endpoints. */
export function isEditsValid(edits: BillEdits): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(edits.bill_date) &&
    !hasMissingAmounts(edits) &&
    (edits.total_amount ?? 0) > 0 &&
    edits.items.length > 0 &&
    edits.items.every((item) => (item.final_price ?? 0) > 0) &&
    // The server needs a name or a category to create a line.
    edits.items.every(
      (item) =>
        item.id || item.name.trim() || item.sub_category || item.category
    ) &&
    receiptFieldErrors(edits).length === 0
  );
}

function marketFields(
  bill: BillDetailResponseDto,
  name: string
): Pick<ConfirmBillRequest, 'market_id' | 'new_market'> {
  // The market is cleared when neither field is sent, so always send one.
  if (!name) return {};
  if (bill.market?.name === name) {
    return { market_id: bill.market.id };
  }
  return { new_market: { name } };
}

/**
 * The confirm body for a draft: the review page's payload, with the market
 * linked by id while its name is unchanged.
 */
export function buildDetailConfirmPayload(
  bill: BillDetailResponseDto,
  edits: BillEdits,
  duplicateOfId?: string | null
): ConfirmBillRequest {
  const { new_market: _ignored, ...body } = buildConfirmPayload(
    edits,
    todayIso(),
    duplicateOfId
  );
  return { ...marketFields(bill, edits.market_name.trim()), ...body };
}

/**
 * Builds the PUT body with only the fields that differ from the loaded bill,
 * compared as sent so 2.490 vs 2.49 is no change. Lines go as the full list
 * when any of them changed, was added or was removed. A cleared market or
 * receipt field is left out: the endpoint cannot clear them. Throws on an
 * empty amount, so callers check isEditsValid first.
 */
export function buildDetailUpdatePayload(
  bill: BillDetailResponseDto,
  edits: BillEdits
): UpdateBillRequest {
  const initial = billToEdits(bill);
  const body: UpdateBillRequest = {};
  const market = edits.market_name.trim();
  if (market && market !== initial.market_name.trim()) {
    Object.assign(body, marketFields(bill, market));
  }
  if (edits.bill_date !== initial.bill_date) body.bill_date = edits.bill_date;
  const total = round2(requireAmount(edits.total_amount));
  if (total !== round2(bill.total_amount)) body.total_amount = total;
  if (edits.currency && edits.currency !== initial.currency) {
    body.currency = edits.currency as Currency;
  }
  for (const field of RECEIPT_FIELDS) {
    const value = edits[field].trim();
    if (value && value !== initial[field]) body[field] = value;
  }
  const items = edits.items.map(toConfirmItem);
  if (
    JSON.stringify(items) !== JSON.stringify(initial.items.map(toConfirmItem))
  ) {
    body.items = items;
  }
  return body;
}
