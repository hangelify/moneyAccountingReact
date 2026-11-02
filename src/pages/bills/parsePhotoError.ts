import { ApiError } from '../../auth/apiError';
import type { AiErrorBody, ParsedBill } from '../../types/bills';

export type ParsePhotoFailure =
  | { kind: 'auth' }
  | { kind: 'forbidden' }
  | { kind: 'bad-photo'; message: string }
  | { kind: 'save-failed'; parsed: ParsedBill; requestId: string | null }
  | { kind: 'retry-later'; message: string; retryAfterSec: number }
  | { kind: 'unavailable'; message: string }
  | {
      kind: 'failed';
      message: string;
      requestId: string | null;
      timedOut: boolean;
    }
  | { kind: 'cancelled' };

const DEFAULT_RETRY_AFTER_SEC = 30;
const UNAVAILABLE_503_MESSAGE = 'Photo recognition is not available';
const BUDGET_429_PREFIX = 'Daily AI budget exceeded';

function isCancel(err: unknown): boolean {
  if (err instanceof ApiError) return err.code === 'ERR_CANCELED';
  return (
    err instanceof Error &&
    (err.name === 'CanceledError' || err.name === 'AbortError')
  );
}

function retryAfterSec(err: ApiError, message: string): number {
  const fromHeader = err.retryAfterSeconds();
  if (fromHeader !== null) return fromHeader;
  const match = /in (\d+) s/.exec(message);
  return match?.[1] ? parseInt(match[1], 10) : DEFAULT_RETRY_AFTER_SEC;
}

export function toParsePhotoFailure(err: unknown): ParsePhotoFailure {
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
    case 413:
    case 415:
      return { kind: 'bad-photo', message };
    case 422:
      return body.parsed
        ? { kind: 'save-failed', parsed: body.parsed, requestId }
        : { kind: 'bad-photo', message };
    case 429:
    case 503: {
      const unavailable =
        err.status === 503
          ? message === UNAVAILABLE_503_MESSAGE
          : message.startsWith(BUDGET_429_PREFIX);
      if (unavailable) return { kind: 'unavailable', message };
      return {
        kind: 'retry-later',
        message,
        retryAfterSec: retryAfterSec(err, message),
      };
    }
    default:
      return {
        kind: 'failed',
        message,
        requestId,
        timedOut: err.code === 'ECONNABORTED',
      };
  }
}
