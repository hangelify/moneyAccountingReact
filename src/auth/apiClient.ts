import axios, {
  AxiosHeaders,
  type AxiosError,
  type InternalAxiosRequestConfig,
  type RawAxiosHeaders,
} from 'axios';
import { tokenStorage } from './tokenStorage';
import { ApiError } from './apiError';
import { authChannel, type SignOutReason } from './authChannel';
import { env } from '@/lib/env';
import { AUTH_ENDPOINTS } from '@/const/auth';
import type { TokenResponseDto } from '@/types/auth';

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export const AUTH_LOGOUT_EVENT = 'auth:logout';
export const AUTH_TOKEN_EVENT = 'auth:token';

const REFRESH_LOCK_NAME = 'auth-refresh';

const REVOKED_MESSAGES = [
  'Session not found or revoked',
  'Session is no longer active',
];

/** 401s from these endpoints never trigger a refresh. */
const NO_REFRESH_PATHS: readonly string[] = [
  AUTH_ENDPOINTS.LOGIN,
  AUTH_ENDPOINTS.REGISTER,
  AUTH_ENDPOINTS.REFRESH,
  AUTH_ENDPOINTS.REVOKE,
  AUTH_ENDPOINTS.LOGOUT,
];

function normaliseHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof headers !== 'object' || headers === null) return out;
  const entries = AxiosHeaders.from(headers as RawAxiosHeaders).toJSON();
  for (const [k, v] of Object.entries(entries)) {
    if (typeof v === 'string') out[k.toLowerCase()] = v;
    else if (typeof v === 'number' || typeof v === 'boolean')
      out[k.toLowerCase()] = String(v);
  }
  return out;
}

function reasonFrom(error: unknown): SignOutReason {
  if (
    error instanceof ApiError &&
    error.messages.some((m) => REVOKED_MESSAGES.includes(m))
  ) {
    return 'revoked';
  }
  return 'expired';
}

/** Only a 401 from /auth/refresh means the session is over. */
function isSessionOver(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** Rejection used when another tab signed out while we waited for the lock. */
class SignedOutElsewhereError extends Error {
  constructor() {
    super('Signed out in another tab');
    this.name = 'SignedOutElsewhereError';
  }
}

/** tokenStorage version right after the last sign-out (local or broadcast). */
let signedOutAtVersion: number | null = null;

/**
 * Clears the session, broadcasts it and notifies the app. Idempotent: a no-op
 * when nothing has been stored since the last sign-out, so N requests failing
 * on the same dead session produce one event and one broadcast.
 */
export function signOut(reason: SignOutReason): void {
  if (signedOutAtVersion === tokenStorage.getVersion()) return;
  tokenStorage.clear({ reason });
  signedOutAtVersion = tokenStorage.getVersion();
  window.dispatchEvent(
    new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { reason } })
  );
}

let refreshInFlight: Promise<void> | null = null;

async function runRefresh(): Promise<void> {
  const versionAtStart = tokenStorage.getVersion();
  const cb = async (): Promise<void> => {
    // Another tab refreshed (and broadcast) while we waited for the lock:
    // its rotated token is already ours, so presenting the cookie again
    // would revoke the session.
    if (
      tokenStorage.getVersion() !== versionAtStart &&
      tokenStorage.getAccessToken()
    ) {
      return;
    }
    // Another tab signed out while we waited: its broadcast already
    // notified this tab, so fail without touching the network.
    if (tokenStorage.getVersion() !== versionAtStart) {
      throw new SignedOutElsewhereError();
    }
    const { data: res } = await apiClient.post<TokenResponseDto>(
      AUTH_ENDPOINTS.REFRESH
    );
    tokenStorage.set(res);
  };
  // `locks` is missing in older browsers and jsdom despite the DOM typings.
  const locks = (navigator as Partial<Navigator>).locks;
  await (locks?.request(REFRESH_LOCK_NAME, cb) ?? cb());
}

/**
 * Refreshes the access token from the HttpOnly refresh cookie. Single-flight
 * per tab (shared promise) and across tabs (Web Lock). Rejects on failure
 * without clearing storage; callers decide whether to `signOut`.
 */
export function refreshAccessToken(): Promise<void> {
  refreshInFlight ??= runRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

// Proactive refresh: only a 401 ends the session. Any other failure is
// swallowed; the next protected request's 401 retries reactively.
tokenStorage.onRefreshDue(
  () =>
    void refreshAccessToken().catch((e: unknown) => {
      if (isSessionOver(e)) signOut(reasonFrom(e));
    })
);

authChannel.subscribe((msg) => {
  if (msg.type === 'token') {
    tokenStorage.set(msg.res, { broadcast: false });
    window.dispatchEvent(new CustomEvent(AUTH_TOKEN_EVENT));
  } else {
    tokenStorage.clear({ broadcast: false });
    signedOutAtVersion = tokenStorage.getVersion();
    window.dispatchEvent(
      new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { reason: msg.reason } })
    );
  }
});

apiClient.interceptors.request.use((config) => {
  const t = tokenStorage.getAccessToken();
  if (t) config.headers.set('Authorization', `Bearer ${t}`);
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

apiClient.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as RetriableConfig | undefined;
    const status = err.response?.status;
    const url = original?.url ?? '';
    const apiError = new ApiError(
      status,
      err.response?.data,
      normaliseHeaders(err.response?.headers),
      err.message
    );
    const skipRefresh = NO_REFRESH_PATHS.some((p) => url.includes(p));

    if (status !== 401 || !original || original._retried || skipRefresh) {
      throw apiError;
    }

    original._retried = true;
    try {
      await refreshAccessToken();
    } catch (refreshError) {
      // 5xx / 403 / network errors leave the session alone.
      if (isSessionOver(refreshError)) signOut(reasonFrom(refreshError));
      throw apiError;
    }

    try {
      // The request interceptor attaches the fresh token on replay.
      return await apiClient(original);
    } catch (replayError) {
      if (replayError instanceof ApiError && replayError.status === 401) {
        signOut(reasonFrom(replayError));
        throw apiError;
      }
      throw replayError;
    }
  }
);
