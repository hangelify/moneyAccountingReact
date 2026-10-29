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

function productCount(item: BillEditItem): number {
  return Math.max(1, Math.round(item.quantity || 0));
}

function productWeight(item: BillEditItem): { product_weight?: number } {
  return item.weight_kg ? { product_weight: round3(item.weight_kg) } : {};
}

function toConfirmItem(item: BillEditItem): ConfirmBillItem {
  return {
    ...(item.id ? { id: item.id } : {}),
    ...(item.sub_category ? { sub_category_id: item.sub_category.id } : {}),
    ...(item.name ? { raw_name: item.name } : {}),
    product_count: productCount(item),
    amount: round2(item.final_price),
    ...productWeight(item),
  };
}

function toCreateItem(item: BillEditItem): CreateBillItem {
  if (!item.sub_category) throw new Error('uncategorised');
  return {
    sub_category_id: item.sub_category.id,
    product_count: productCount(item),
    amount: round2(item.final_price),
    ...productWeight(item),
  };
}

export function buildConfirmPayload(
  edits: BillEdits,
  today: string = todayIso()
): ConfirmBillRequest {
  return {
    ...(edits.market_name ? { new_market: { name: edits.market_name } } : {}),
    bill_date: edits.bill_date || today,
    ...(edits.currency ? { currency: edits.currency } : {}),
    total_amount: round2(edits.total_amount),
    items: edits.items.map(toConfirmItem),
  };
}

export function buildCreatePayload(
  edits: BillEdits,
  today: string = todayIso()
): CreateBillRequest {
  return {
    bill_date: edits.bill_date || today,
    ...(edits.currency ? { currency: edits.currency } : {}),
    total_amount: round2(edits.total_amount),
    items: edits.items.map(toCreateItem),
  };
}
