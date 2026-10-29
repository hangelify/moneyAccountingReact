import type { ApiError } from '@/auth/apiError';

/** The server's per-field messages for the given form fields only. */
export function fieldErrorsFor<F extends string>(
  error: ApiError,
  fields: readonly F[]
): [F, string][] {
  const isField = (name: string): name is F =>
    (fields as readonly string[]).includes(name);
  return Object.entries(error.fieldErrors()).filter(
    (entry): entry is [F, string] => isField(entry[0])
  );
}
