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

export interface ParsedBill {
  draft_id: string;
  market_name: string | null;
  bill_date: string | null;
  currency: string | null;
  total_amount: number | null;
  items: ParsedBillItem[];
}

export interface ParsePhotoResponse extends ParsedBill {
  request_id: string | null;
  duplicate: boolean;
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
}

export interface BillEditItem {
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
}

export interface MarketRef {
  id: string;
  name: string;
  city: string | null;
}

export interface BillResponseDto {
  id: string;
  bill_date: string;
  total_amount: number;
  currency: Currency | null;
  description: string | null;
  market: MarketRef | null;
  created_at: string;
}

export interface BillDetailItem {
  sub_category: SubCategoryRef | null;
  product_count: number;
  amount: number;
  product_weight: number | null;
}

export interface BillDetailResponseDto extends BillResponseDto {
  items: BillDetailItem[];
}
