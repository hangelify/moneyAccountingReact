import type { Currency } from '@/const/currency';

export type BillUnit = 'kg' | 'g' | 'l' | 'ml' | 'piece';

export interface SubCategoryRef {
  id: string;
  name: string;
  category_name: string;
}

export interface ParsedBillItem {
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

export interface ParsedBillResponse {
  market_name: string | null;
  bill_date: string | null;
  currency: string | null;
  total_amount: number | null;
  items: ParsedBillItem[];
  raw_extracted_text: string;
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
