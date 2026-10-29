/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import {
  HouseholdContext,
  type HouseholdContextValue,
} from '@/contexts/HouseholdContext';
import type { Household } from '@/types/households';

export const TEST_HID = 'hh-1';

export const TEST_HOUSEHOLDS: Household[] = [
  {
    id: 'hh-1',
    name: 'Personal',
    created_at: '2026-01-01T00:00:00Z',
    member_count: 1,
  },
  {
    id: 'hh-2',
    name: 'Family Budget',
    created_at: '2026-02-01T00:00:00Z',
    member_count: 3,
  },
];

export const makeHouseholdValue = (
  overrides: Partial<HouseholdContextValue> = {}
): HouseholdContextValue => ({
  status: 'ready',
  households: TEST_HOUSEHOLDS,
  activeHousehold: TEST_HOUSEHOLDS[0] ?? null,
  setActiveHouseholdId: vi.fn(),
  handleForbidden: vi.fn().mockResolvedValue(undefined),
  refetch: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

export function HouseholdTestProvider({
  value = makeHouseholdValue(),
  children,
}: {
  value?: HouseholdContextValue;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  );
}
