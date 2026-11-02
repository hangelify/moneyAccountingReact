import type {
  BillDetailResponseDto,
  ConfirmBillItem,
  ConfirmBillRequest,
  SubCategoryRef,
  UpdateBillRequest,
} from '@/types/bills';

/** Editable form state of the bill detail drawer; numbers kept as typed. */
export interface BillDetailDraft {
  market: string;
  date: string;
  total: string;
  items: {
    // The draft line id; sent back so the server updates the line in place.
    id: string | undefined;
    subCategory: SubCategoryRef | null;
    amount: string;
    count: string;
    weight: string;
  }[];
}

const round2 = (x: number): number => Math.round(x * 100) / 100;
const round3 = (x: number): number => Math.round(x * 1000) / 1000;

export function toDraft(bill: BillDetailResponseDto): BillDetailDraft {
  return {
    market: bill.market?.name ?? bill.market_name_raw ?? '',
    date: bill.bill_date.slice(0, 10),
    total: String(bill.total_amount),
    items: bill.items.map((item) => ({
      id: item.id,
      subCategory: item.sub_category,
      amount: String(item.amount),
      count: String(item.product_count),
      weight: item.product_weight == null ? '' : String(item.product_weight),
    })),
  };
}

const isPositive = (value: string): boolean =>
  value.trim() !== '' && Number(value) > 0;

/** Whether the draft satisfies the confirm endpoint's required fields. */
export function isDraftValid(draft: BillDetailDraft): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(draft.date) &&
    isPositive(draft.total) &&
    draft.items.length > 0 &&
    draft.items.every((item) => isPositive(item.amount))
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

function toItems(draft: BillDetailDraft): ConfirmBillItem[] {
  return draft.items.map(
    (item): ConfirmBillItem => ({
      ...(item.id ? { id: item.id } : {}),
      ...(item.subCategory ? { sub_category_id: item.subCategory.id } : {}),
      product_count: Math.max(1, Math.round(Number(item.count) || 0)),
      amount: round2(Number(item.amount)),
      ...(item.weight.trim() !== '' && Number(item.weight) > 0
        ? { product_weight: round3(Number(item.weight)) }
        : {}),
    })
  );
}

/**
 * Builds the confirm body from the draft. Only fields of ConfirmBillRequest
 * are sent: the endpoint rejects unknown ones. Currency and description are
 * not editable here and are left out, so the server keeps them.
 */
export function buildDetailConfirmPayload(
  bill: BillDetailResponseDto,
  draft: BillDetailDraft,
  duplicateOfId?: string | null
): ConfirmBillRequest {
  return {
    ...(duplicateOfId ? { duplicate_of_id: duplicateOfId } : {}),
    ...marketFields(bill, draft.market.trim()),
    bill_date: draft.date,
    total_amount: round2(Number(draft.total)),
    items: toItems(draft),
  };
}

/**
 * Builds the PUT body with only the fields that differ from the loaded bill,
 * compared as sent so "7.20" vs "7.2" is no change. Lines go as the full list
 * when any of them changed. A cleared market is left out: the endpoint cannot
 * clear it.
 */
export function buildDetailUpdatePayload(
  bill: BillDetailResponseDto,
  draft: BillDetailDraft
): UpdateBillRequest {
  const initial = toDraft(bill);
  const body: UpdateBillRequest = {};
  const market = draft.market.trim();
  if (market && market !== initial.market.trim()) {
    Object.assign(body, marketFields(bill, market));
  }
  if (draft.date !== initial.date) body.bill_date = draft.date;
  const total = round2(Number(draft.total));
  if (total !== round2(Number(initial.total))) body.total_amount = total;
  const items = toItems(draft);
  if (JSON.stringify(items) !== JSON.stringify(toItems(initial))) {
    body.items = items;
  }
  return body;
}
