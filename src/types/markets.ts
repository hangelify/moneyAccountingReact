export interface MarketResponseDto {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
  bill_count: number;
}
