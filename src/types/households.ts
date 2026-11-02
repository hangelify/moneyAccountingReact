import type { Currency } from '@/const/currency';

export interface Household {
  id: string;
  name: string;
  currency: Currency;
  // Absent until the API ships it.
  role?: 'owner' | 'member';
  created_at: string;
  member_count: number;
}

export interface UpdateHouseholdRequest {
  name?: string;
  currency?: Currency;
}
