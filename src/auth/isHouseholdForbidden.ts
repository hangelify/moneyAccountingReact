import { ApiError } from './apiError';

/** True for a 403 on a `/households/…` request: the caller lost access. */
export function isHouseholdForbidden(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 403 &&
    err.url.startsWith('/households/')
  );
}
