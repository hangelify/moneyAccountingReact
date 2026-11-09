import type { Currency } from '@/const/currency';

export type BillUnit = 'kg' | 'g' | 'l' | 'ml' | 'piece';

export interface SubCategoryRef {
  id: string;
  name: string;
  category_name: string;
}

export interface ParsedBillItem {
  id?: string;
  name: string;
  quantity: number | null;
  unit: BillUnit | null;
  weight_kg: number | null;
  price_per_kg: number | null;
  final_price: number;
  sub_category: SubCategoryRef | null;
  category_confidence: number;
  category_reasoning?: string;
}

export type DuplicateMatch = 'fiscal' | 'strong' | 'weak';

// Another bill that may be the same purchase, or the original of a duplicate.
export interface PossibleDuplicate {
  id: string;
  bill_date: string; // YYYY-MM-DD
  total_amount: number;
  currency: string | null;
  market_name: string | null;
  created_by_name: string | null;
  match?: DuplicateMatch; // absent on duplicate_of
}

// Fiscal ids printed on the receipt; null when not read.
export interface ReceiptIdentity {
  fiscal_register_id: string | null;
  fiscal_receipt_number: string | null;
  purchase_time: string | null; // HH:MM
}

export interface DuplicateSuggestionPair {
  bill: PossibleDuplicate;
  other: PossibleDuplicate;
  match: DuplicateMatch;
}

export interface DuplicateSuggestionsResponse {
  pairs: DuplicateSuggestionPair[];
}

export interface DuplicateRange {
  date_from: string | null;
  date_to: string | null;
}

export interface ParsedBill extends Partial<ReceiptIdentity> {
  draft_id: string;
  market_name: string | null;
  bill_date: string | null;
  currency: string | null;
  total_amount: number | null;
  items: ParsedBillItem[];
}

export interface ParsePhotoResponse extends ParsedBill {
  request_id: string | null;
  // true = the same photo was uploaded again and its open draft came back.
  duplicate: boolean;
  // Confirmed bills that may be the same purchase; always sent.
  possible_duplicates: PossibleDuplicate[];
}

export interface AiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  request_id: string | null;
  parsed?: ParsedBill;
}

export interface ConfirmBillItem {
  id?: string;
  sub_category_id?: string;
  raw_name?: string;
  product_count: number;
  amount: number;
  product_weight?: number;
}

export interface ConfirmBillRequest {
  market_id?: string;
  new_market?: {
    name: string;
    city?: string;
    country?: string;
    address?: string;
  };
  bill_date: string;
  currency?: Currency;
  total_amount: number;
  description?: string;
  items: ConfirmBillItem[];
  duplicate_of_id?: string;
  fiscal_register_id?: string;
  fiscal_receipt_number?: string;
  purchase_time?: string;
}

// PUT /bills/:id. Omitted = keep; items, when sent, is the full new list.
export interface UpdateBillRequest {
  market_id?: string;
  new_market?: ConfirmBillRequest['new_market'];
  bill_date?: string;
  currency?: Currency;
  total_amount?: number;
  description?: string;
  fiscal_register_id?: string;
  fiscal_receipt_number?: string;
  purchase_time?: string;
  items?: ConfirmBillItem[];
}

export interface CreateBillItem {
  sub_category_id: string;
  product_count: number;
  amount: number;
  product_weight?: number;
}

export interface CreateBillRequest {
  market_id?: string;
  bill_date: string;
  currency?: Currency;
  total_amount: number;
  description?: string;
  items: CreateBillItem[];
  duplicate_of_id?: string;
  fiscal_register_id?: string;
  fiscal_receipt_number?: string;
  purchase_time?: string;
}

export interface BillEditItem {
  id?: string;
  name: string;
  quantity: number;
  unit: BillUnit | '';
  weight_kg: number | null;
  price_per_kg: number | null;
  final_price: number;
  sub_category: SubCategoryRef | null;
  category_confidence: number;
  category_reasoning?: string | undefined;
}

export interface BillEdits {
  market_name: string;
  bill_date: string;
  currency: string;
  total_amount: number;
  items: BillEditItem[];
  // Receipt identity as typed; '' when empty.
  fiscal_register_id: string;
  fiscal_receipt_number: string;
  purchase_time: string;
}

export interface MarketRef {
  id: string;
  name: string;
  city: string | null;
}

export interface ExchangeRate {
  rate: number; // household currency per 1 unit of the bill's currency
  rate_date: string; // YYYY-MM-DD, up to 7 days before bill_date
}

export interface BillResponseDto {
  id: string;
  bill_date: string;
  total_amount: number;
  amount_mismatch: boolean;
  // The API omits these keys when empty; older responses sent null.
  currency?: Currency | null;
  description?: string | null;
  market?: MarketRef | null;
  created_at: string;
  // Number of line items. Requested from the backend; absent until it ships.
  items_count?: number;
  // Total in the household currency. The drafts list omits both; the amount
  // is null when the bill has no currency or no rate is available.
  household_currency?: Currency;
  household_amount?: number | null;
  // Confirmed-list rows only; drafts have their own status.
  status?: 'draft' | 'confirmed' | 'duplicate' | 'failed';
  duplicate_of_id?: string | null;
}

export interface DraftBillItem {
  id: string;
  raw_name: string;
  sub_category: SubCategoryRef | null;
  product_count: number;
  amount: number;
  product_weight?: number;
  unit?: BillUnit;
  price_per_unit?: number;
  category_confidence?: number;
  category_reasoning?: string;
}

// A row of GET /bills/drafts: the summary plus receipt fields and items.
export interface DraftBillDto extends Omit<BillResponseDto, 'status'> {
  status: 'draft' | 'confirmed' | 'failed';
  parse_error_code?: ParseErrorCode | null;
  parse_error_message?: string | null;
  market_name_raw?: string;
  // true = no date on the receipt; bill_date is the upload day.
  bill_date_inferred: boolean;
  items: DraftBillItem[];
}

export interface BillDetailItem {
  id: string;
  raw_name: string;
  sub_category: SubCategoryRef | null;
  product_count: number;
  amount: number;
  product_weight: number | null;
}

export interface BillDetailResponseDto
  extends BillResponseDto, Partial<ReceiptIdentity> {
  market_name_raw?: string;
  parse_error_code?: ParseErrorCode | null;
  parse_error_message?: string | null;
  items: BillDetailItem[];
  // null when already in the household currency or not convertible.
  exchange_rate?: ExchangeRate | null;
  // Look-alikes of this bill; [] on a duplicate.
  possible_duplicates?: PossibleDuplicate[];
  // The original when status is 'duplicate'.
  duplicate_of?: PossibleDuplicate | null;
}

export type BatchItemStatus = 'queued' | 'processing' | 'done' | 'failed';
export type ParseErrorCode = 'not_a_receipt' | 'ai_failed' | 'save_failed';

export interface BillBatchItem {
  id: string;
  position: number;
  status: BatchItemStatus;
  bill_id: string | null;
  parse_error_code: ParseErrorCode | null;
  parse_error_message: string | null;
}

export interface BillBatch {
  batch_id: string;
  created_at: string;
  total: number;
  completed: boolean;
  items: BillBatchItem[];
}

export type BillEventType =
  | 'item.processing'
  | 'item.done'
  | 'item.failed'
  | 'batch.completed';

export interface ItemEventData {
  batch_id: string;
  item_id: string;
  position: number;
  status: BatchItemStatus;
  created_by_user_id: string | null;
  bill_id?: string;
  parse_error_code?: ParseErrorCode;
  parse_error_message?: string;
}

export interface BatchCompletedData {
  batch_id: string;
  total: number;
  done: number;
  failed: number;
  created_by_user_id: string | null;
}

export type BillEventData = ItemEventData | BatchCompletedData;
