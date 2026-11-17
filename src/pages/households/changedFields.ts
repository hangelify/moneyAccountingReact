import type { HouseholdSettingsFormData } from '@/lib/validation-schemas';
import type { Household, UpdateHouseholdRequest } from '@/types/households';

/**
 * The PUT body: only what differs from the saved household; {} = unchanged.
 * The name is the owner's main name, so it is compared with original_name.
 */
export function changedFields(
  initial: Household,
  values: HouseholdSettingsFormData
): UpdateHouseholdRequest {
  const name = values.name.trim();
  return {
    ...(name !== initial.original_name && { name }),
    ...(values.currency !== initial.currency && { currency: values.currency }),
  };
}
