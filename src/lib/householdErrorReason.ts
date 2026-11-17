import { ApiError } from '@/auth/apiError';

export type HouseholdErrorReason =
  | 'household_limit'
  | 'last_household'
  | 'household_has_members';

const REASONS: readonly string[] = [
  'household_limit',
  'last_household',
  'household_has_members',
];

/** The machine-readable reason of a 409 from the households API, else null. */
export function householdErrorReason(
  err: unknown
): HouseholdErrorReason | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const reason =
    typeof err.body === 'object' && err.body !== null
      ? (err.body as { reason?: unknown }).reason
      : undefined;
  return typeof reason === 'string' && REASONS.includes(reason)
    ? (reason as HouseholdErrorReason)
    : null;
}
