import { describe, it, expect } from 'vitest';
import { ApiError } from '@/auth/apiError';
import { householdErrorReason } from './householdErrorReason';

describe('householdErrorReason', () => {
  it('returns the reason of a 409', () => {
    expect(
      householdErrorReason(new ApiError(409, { reason: 'last_household' }))
    ).toBe('last_household');
  });

  it('ignores unknown reasons', () => {
    expect(
      householdErrorReason(new ApiError(409, { reason: 'other' }))
    ).toBeNull();
  });

  it('ignores other statuses', () => {
    expect(
      householdErrorReason(new ApiError(400, { reason: 'household_limit' }))
    ).toBeNull();
  });

  it('ignores non-ApiError', () => {
    expect(householdErrorReason(new Error())).toBeNull();
  });
});
