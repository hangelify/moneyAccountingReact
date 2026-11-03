import { ApiError } from '../../auth/apiError';

const DEFAULT_RETRY_AFTER_SEC = 30;

export function isCancel(err: unknown): boolean {
  if (err instanceof ApiError) return err.code === 'ERR_CANCELED';
  return (
    err instanceof Error &&
    (err.name === 'CanceledError' || err.name === 'AbortError')
  );
}

export function retryAfterSec(err: ApiError, message: string): number {
  const fromHeader = err.retryAfterSeconds();
  if (fromHeader !== null) return fromHeader;
  const match = /in (\d+) s/.exec(message);
  return match?.[1] ? parseInt(match[1], 10) : DEFAULT_RETRY_AFTER_SEC;
}
