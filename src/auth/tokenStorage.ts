import type { TokenResponseDto } from '@/types/auth';
import { authChannel, type SignOutReason } from './authChannel';

const REFRESH_LEAD_SECONDS = 60;
const MIN_REFRESH_DELAY_SECONDS = 5;

let accessToken: string | null = null;
let expiresAt: number | null = null;
let version = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let refreshDue: (() => void) | null = null;

function cancelTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

export const tokenStorage = {
  getAccessToken: (): string | null => accessToken,
  getExpiresAt: (): number | null => expiresAt,
  getVersion: (): number => version,
  set(res: TokenResponseDto, opts: { broadcast?: boolean } = {}): void {
    const { broadcast = true } = opts;
    accessToken = res.access_token;
    expiresAt = Date.now() + res.expires_in * 1000;
    version += 1;
    cancelTimer();
    const delaySeconds = Math.max(
      res.expires_in - REFRESH_LEAD_SECONDS,
      MIN_REFRESH_DELAY_SECONDS
    );
    timer = setTimeout(() => {
      timer = null;
      refreshDue?.();
    }, delaySeconds * 1000);
    if (broadcast) authChannel.post({ type: 'token', res });
  },
  clear(opts: { broadcast?: boolean; reason?: SignOutReason } = {}): void {
    const { broadcast = true, reason = 'user' } = opts;
    accessToken = null;
    expiresAt = null;
    version += 1;
    cancelTimer();
    if (broadcast) authChannel.post({ type: 'logout', reason });
  },
  onRefreshDue(fn: () => void): void {
    refreshDue = fn;
  },
};
