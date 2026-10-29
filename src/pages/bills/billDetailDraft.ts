import type {
  BillDetailResponseDto,
  ConfirmBillItem,
  ConfirmBillRequest,
  SubCategoryRef,
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

/**
 * Builds the confirm body from the draft. Only fields of ConfirmBillRequest
 * are sent: the endpoint rejects unknown ones. Currency and description are
 * not editable here and are left out, so the server keeps them.
 */
export function buildDetailConfirmPayload(
  bill: BillDetailResponseDto,
  draft: BillDetailDraft
): ConfirmBillRequest {
  return {
    ...marketFields(bill, draft.market.trim()),
    bill_date: draft.date,
    total_amount: round2(Number(draft.total)),
    items: draft.items.map(
      (item): ConfirmBillItem => ({
        ...(item.id ? { id: item.id } : {}),
        ...(item.subCategory ? { sub_category_id: item.subCategory.id } : {}),
        product_count: Math.max(1, Math.round(Number(item.count) || 0)),
        amount: round2(Number(item.amount)),
        ...(item.weight.trim() !== '' && Number(item.weight) > 0
          ? { product_weight: round3(Number(item.weight)) }
          : {}),
      })
    ),
  };
}
