export const HOUSEHOLDS_ENDPOINTS = {
  LIST: '/households',
} as const;

export const ACTIVE_HOUSEHOLD_STORAGE_KEY = 'activeHouseholdId';

export const householdPath = (hid: string, path = ''): string =>
  `/households/${encodeURIComponent(hid)}${path}`;
