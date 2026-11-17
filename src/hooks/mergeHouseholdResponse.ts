import type { Household, HouseholdResponse } from '@/types/households';

/**
 * Fold a POST/PUT response into the GET /households list. The response has
 * no `bill_count` (and, for some endpoints, no `role`), so those are kept
 * from the existing row. Untouched rows keep their identity.
 */
export function mergeHouseholdResponse(
  list: Household[] | undefined,
  saved: HouseholdResponse
): Household[] | undefined {
  return list?.map((h) =>
    h.id === saved.id
      ? {
          ...h,
          name: saved.name,
          original_name: saved.original_name,
          currency: saved.currency,
          member_count: saved.member_count,
          role: saved.role ?? h.role,
        }
      : h
  );
}
