import { ApiError } from '../../auth/apiError';
import type { AiErrorBody } from '../../types/bills';
import { isCancel, retryAfterSec } from './retryAfter';

export type BatchUploadFailure =
  | { kind: 'cancelled' }
  | { kind: 'auth' }
  | { kind: 'forbidden' }
  | { kind: 'bad-file'; fileIndex: number | null; message: string }
  | { kind: 'retry-later'; message: string; retryAfterSec: number }
  | { kind: 'budget'; message: string }
  | { kind: 'busy'; message: string; retryAfterSec: number }
  | { kind: 'disabled'; message: string }
  | {
      kind: 'failed';
      message: string;
      requestId: string | null;
      timedOut: boolean;
    };

const DISABLED_503_MESSAGE = 'Batch photo parsing is disabled';
const BUDGET_429_PREFIX = 'Daily AI budget exceeded';

// The server sends Retry-After: 5 on a busy 503, but CORS does not expose
// the header and the message carries no seconds.
const BUSY_503_RETRY_AFTER_SEC = 5;

/** Server "File N:" is already 0-based (append order); returns N, or null. */
export function fileIndexFromMessage(message: string): number | null {
  const match = /^File (\d+):/.exec(message);
  if (!match?.[1]) return null;
  return parseInt(match[1], 10);
}

export function toBatchUploadFailure(err: unknown): BatchUploadFailure {
  if (isCancel(err)) return { kind: 'cancelled' };
  if (!(err instanceof ApiError)) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return { kind: 'failed', message, requestId: null, timedOut: false };
  }

  const body = (
    typeof err.body === 'object' && err.body !== null ? err.body : {}
  ) as Partial<AiErrorBody>;
  const message = typeof body.message === 'string' ? body.message : err.message;
  const requestId =
    typeof body.request_id === 'string' ? body.request_id : null;

  switch (err.status) {
    case 401:
      return { kind: 'auth' };
    case 403:
      return { kind: 'forbidden' };
    case 400:
    case 413:
    case 415:
      return {
        kind: 'bad-file',
        fileIndex: fileIndexFromMessage(message),
        message,
      };
    case 429:
      if (message.startsWith(BUDGET_429_PREFIX)) {
        return { kind: 'budget', message };
      }
      return {
        kind: 'retry-later',
        message,
        retryAfterSec: retryAfterSec(err, message),
      };
    case 503:
      if (message === DISABLED_503_MESSAGE)
        return { kind: 'disabled', message };
      return {
        kind: 'busy',
        message,
        retryAfterSec: retryAfterSec(err, message, BUSY_503_RETRY_AFTER_SEC),
      };
    default:
      return {
        kind: 'failed',
        message,
        requestId,
        timedOut: err.code === 'ECONNABORTED',
      };
  }
}
