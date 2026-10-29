import { describe, it, expect } from 'vitest';
import { ApiError } from './apiError';
import { isHouseholdForbidden } from './isHouseholdForbidden';

const err = (status: number, url: string) =>
  new ApiError(status, {}, {}, undefined, { url });

describe('isHouseholdForbidden', () => {
  it('is true for a 403 on a household path', () => {
    expect(isHouseholdForbidden(err(403, '/households/h1/bills'))).toBe(true);
  });

  it('is false for a 403 outside households', () => {
    expect(isHouseholdForbidden(err(403, '/auth/me'))).toBe(false);
  });

  it('is false for a 404 on a household path', () => {
    expect(isHouseholdForbidden(err(404, '/households/h1'))).toBe(false);
  });

  it('is false for a plain Error', () => {
    expect(isHouseholdForbidden(new Error('x'))).toBe(false);
  });
});
