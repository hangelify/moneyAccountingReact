import type {
  BillEditItem,
  BillEdits,
  ConfirmBillItem,
  ConfirmBillRequest,
  CreateBillItem,
  CreateBillRequest,
} from '@/types/bills';

const round2 = (x: number): number => Math.round(x * 100) / 100;
const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/** Local-time `YYYY-MM-DD`. */
export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Callers check hasMissingAmounts first; an empty field is never sent as 0.
export function requireAmount(value: number | null): number {
  if (value === null) throw new Error('missing amount');
  return value;
}

/** Whether the total, or any line's price or quantity, is left empty. */
export function hasMissingAmounts(
  edits: Pick<BillEdits, 'total_amount' | 'items'>
): boolean {
  return (
    edits.total_amount === null ||
    edits.items.some(
      (item) => item.final_price === null || item.quantity === null
    )
  );
}

function productCount(item: BillEditItem): number {
  return Math.max(1, Math.round(requireAmount(item.quantity)));
}

function productWeight(item: BillEditItem): { product_weight?: number } {
  return item.weight_kg ? { product_weight: round3(item.weight_kg) } : {};
}

export function toConfirmItem(item: BillEditItem): ConfirmBillItem {
  return {
    ...(item.id ? { id: item.id } : {}),
    ...(item.sub_category ? { sub_category_id: item.sub_category.id } : {}),
    ...(item.name ? { raw_name: item.name } : {}),
    product_count: productCount(item),
    amount: round2(requireAmount(item.final_price)),
    ...productWeight(item),
  };
}

function toCreateItem(item: BillEditItem): CreateBillItem {
  if (!item.sub_category) throw new Error('uncategorised');
  return {
    sub_category_id: item.sub_category.id,
    product_count: productCount(item),
    amount: round2(requireAmount(item.final_price)),
    ...productWeight(item),
  };
}

type ReceiptField =
  | 'fiscal_register_id'
  | 'fiscal_receipt_number'
  | 'purchase_time';

const RECEIPT_FIELDS: ReceiptField[] = [
  'fiscal_register_id',
  'fiscal_receipt_number',
  'purchase_time',
];
const RECEIPT_ID_MAX = 64;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Receipt fields the API would reject: ids over 64 chars, time not HH:MM. */
export function receiptFieldErrors(
  edits: Pick<BillEdits, ReceiptField>
): ReceiptField[] {
  return RECEIPT_FIELDS.filter((field) => {
    const value = edits[field].trim();
    if (value === '') return false;
    return field === 'purchase_time'
      ? !HH_MM.test(value)
      : value.length > RECEIPT_ID_MAX;
  });
}

// The confirm and create endpoints reject unknown or empty fields, so only
// the filled-in ones are sent.
function receiptFields(
  edits: BillEdits
): Partial<Record<ReceiptField, string>> {
  const out: Partial<Record<ReceiptField, string>> = {};
  for (const field of RECEIPT_FIELDS) {
    const value = edits[field].trim();
    if (value) out[field] = value;
  }
  return out;
}

function duplicateOf(id: string | null | undefined): {
  duplicate_of_id?: string;
} {
  return id ? { duplicate_of_id: id } : {};
}

export function buildConfirmPayload(
  edits: BillEdits,
  today: string = todayIso(),
  duplicateOfId?: string | null
): ConfirmBillRequest {
  return {
    ...(edits.market_name ? { new_market: { name: edits.market_name } } : {}),
    bill_date: edits.bill_date || today,
    ...(edits.currency ? { currency: edits.currency } : {}),
    total_amount: round2(requireAmount(edits.total_amount)),
    items: edits.items.map(toConfirmItem),
    ...receiptFields(edits),
    ...duplicateOf(duplicateOfId),
  };
}

export function buildCreatePayload(
  edits: BillEdits,
  today: string = todayIso(),
  duplicateOfId?: string | null
): CreateBillRequest {
  return {
    bill_date: edits.bill_date || today,
    ...(edits.currency ? { currency: edits.currency } : {}),
    total_amount: round2(requireAmount(edits.total_amount)),
    items: edits.items.map(toCreateItem),
    ...receiptFields(edits),
    ...duplicateOf(duplicateOfId),
  };
}
