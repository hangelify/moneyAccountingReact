import { ACTIVE_HOUSEHOLD_STORAGE_KEY } from '@/const/households';
import type { Household } from '@/types/households';

export const pickActiveHousehold = (
  list: Household[],
  rememberedId: string | null
): Household | null =>
  list.find((h) => h.id === rememberedId) ?? list[0] ?? null;

export const readRememberedHouseholdId = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_HOUSEHOLD_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const writeRememberedHouseholdId = (id: string | null): void => {
  try {
    if (id === null) localStorage.removeItem(ACTIVE_HOUSEHOLD_STORAGE_KEY);
    else localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, id);
  } catch {
    // storage unavailable (private mode, blocked); remembering is best-effort
  }
};
