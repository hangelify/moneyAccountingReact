import { ApiError } from '@/auth/apiError';
import type { MoveConflict, MoveConflictReason } from '@/types/bills';

const KNOWN: readonly MoveConflictReason[] = [
  'status_not_movable',
  'has_duplicates',
  'draft_image_conflict',
  'client_batch_conflict',
];

function bodyField(err: ApiError, key: string): unknown {
  return typeof err.body === 'object' && err.body !== null
    ? (err.body as Record<string, unknown>)[key]
    : undefined;
}

function toConflict(raw: unknown): MoveConflict | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { id, reason } = raw as Record<string, unknown>;
  if (typeof id !== 'string') return null;
  const known = KNOWN.find((r) => r === reason);
  return { id, reason: known ?? 'unknown' };
}

/** The bills a 409 from the move endpoint names, else null. */
export function readMoveConflicts(err: unknown): MoveConflict[] | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const raw = bodyField(err, 'conflicts');
  if (!Array.isArray(raw)) return null;
  return raw.map(toConflict).filter((c): c is MoveConflict => c !== null);
}

/** The bill ids a 404 from the move endpoint names, else null. */
export function readMissingIds(err: unknown): string[] | null {
  if (!(err instanceof ApiError) || err.status !== 404) return null;
  const raw = bodyField(err, 'bill_ids');
  if (!Array.isArray(raw)) return null;
  return raw.filter((id): id is string => typeof id === 'string');
}
