import { fetchEventSource } from '@microsoft/fetch-event-source';
import { refreshAccessToken, signOut } from '@/auth/apiClient';
import { ApiError } from '@/auth/apiError';
import { tokenStorage } from '@/auth/tokenStorage';
import { BILLS_ENDPOINTS } from '@/const/bills';
import { householdPath } from '@/const/households';
import { env } from '@/lib/env';
import type { BillEventData, BillEventType } from '@/types/bills';

export interface BillEventHandlers {
  onOpen: () => void;
  onReconnected: () => void;
  onEvent: (type: BillEventType, data: BillEventData) => void;
  onForbidden: () => void;
}

const RECONNECT_MS = 2000;
const BACKOFF_START_MS = 30_000;
const BACKOFF_MAX_MS = 300_000;

/** Reconnect after the short, fixed delay (close, network error, 401 refreshed). */
class RetryError extends Error {}
/** The refresh after a 401 was rejected with 401: the session is over. */
class SessionOverError extends Error {}
/** 403: the user may not read this household's events. */
class ForbiddenError extends Error {}
/** Non-OK status or a non-SSE response: retry with the server backoff. */
class ServerError extends Error {}

export function listenBillEvents(
  hid: string,
  h: BillEventHandlers
): () => void {
  const url = `${env.apiUrl}${householdPath(hid, BILLS_ENDPOINTS.EVENTS)}`;
  const ctrl = new AbortController();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let opens = 0;
  let backoff = BACKOFF_START_MS;

  function scheduleReconnect(ms: number): void {
    if (stopped) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      connect();
    }, ms);
  }

  /** The one place an outcome becomes an action. */
  function classify(err: unknown): void {
    if (stopped) return;
    if (err instanceof SessionOverError) {
      stopped = true;
      signOut('expired');
    } else if (err instanceof ForbiddenError) {
      stopped = true;
      h.onForbidden();
    } else if (err instanceof ServerError) {
      const ms = backoff;
      backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
      scheduleReconnect(ms);
    } else {
      scheduleReconnect(RECONNECT_MS);
    }
  }

  function connect(): void {
    if (stopped) return;
    const token = tokenStorage.getAccessToken();
    fetchEventSource(url, {
      signal: ctrl.signal,
      openWhenHidden: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      async onopen(res) {
        if (stopped) return;
        const type = res.headers.get('content-type') ?? '';
        if (res.ok && type.includes('text/event-stream')) {
          backoff = BACKOFF_START_MS;
          opens += 1;
          h.onOpen();
          if (opens > 1) h.onReconnected();
          return;
        }
        if (res.status === 401) {
          try {
            await refreshAccessToken();
          } catch (e) {
            if (e instanceof ApiError && e.status === 401) {
              throw new SessionOverError();
            }
          }
          throw new RetryError();
        }
        if (res.status === 403) throw new ForbiddenError();
        throw new ServerError(`Unexpected status ${res.status}`);
      },
      onmessage(msg) {
        if (msg.event === 'ping' || !msg.data) return;
        let data: BillEventData;
        try {
          data = JSON.parse(msg.data) as BillEventData;
        } catch {
          return;
        }
        h.onEvent(msg.event as BillEventType, data);
      },
      onclose() {
        throw new RetryError();
      },
      onerror(err) {
        classify(err);
        throw err;
      },
    }).catch(() => {
      // Outcomes are handled in onerror; this only stops an unhandled rejection.
    });
  }

  connect();

  return () => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    ctrl.abort();
  };
}
