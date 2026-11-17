import type { Currency } from '@/const/currency';

/** Response of POST/PUT /households. */
export interface HouseholdResponse {
  id: string;
  name: string;
  original_name: string;
  currency: Currency;
  created_at: string;
  member_count: number;
  role?: 'owner' | 'member';
}

/** A row of GET /households. */
export interface Household extends HouseholdResponse {
  role: 'owner' | 'member';
  bill_count: number;
}

export interface CreateHouseholdRequest {
  name: string;
  currency: Currency;
}

export interface UpdateHouseholdRequest {
  name?: string;
  currency?: Currency;
}

export interface UpdateMyHouseholdRequest {
  display_name: string | null;
}
