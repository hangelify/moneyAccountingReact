import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { withHid } from '@/lib/billPath';

/** Adds the active budget to a bill link's search, so a shared link opens in it. */
export function useWithActiveHid(): (search: string) => string {
  const hid = useActiveHouseholdId();
  return (search) => (hid === null ? search : withHid(search, hid));
}
