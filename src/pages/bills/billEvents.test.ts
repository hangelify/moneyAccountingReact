import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchEventSource,
  type FetchEventSourceInit,
} from '@microsoft/fetch-event-source';
import { refreshAccessToken, signOut } from '@/auth/apiClient';
import { ApiError } from '@/auth/apiError';
import { listenBillEvents, type BillEventHandlers } from './billEvents';

vi.mock('@microsoft/fetch-event-source', () => ({ fetchEventSource: vi.fn() }));
vi.mock('@/auth/apiClient', () => ({
  refreshAccessToken: vi.fn(),
  signOut: vi.fn(),
}));

let token: string | null = 'tok-1';
vi.mock('@/auth/tokenStorage', () => ({
  tokenStorage: { getAccessToken: () => token },
}));
vi.mock('@/lib/env', () => ({ env: { apiUrl: 'http://api.test' } }));

type Opts = FetchEventSourceInit &
  Required<
    Pick<FetchEventSourceInit, 'onopen' | 'onmessage' | 'onclose' | 'onerror'>
  >;
const calls: Opts[] = [];
const at = (i: number): Opts => {
  const o = calls[i];
  if (!o) throw new Error(`no call ${i}`);
  return o;
};

const sseResponse = (status = 200, type = 'text/event-stream'): Response =>
  new Response(null, { status, headers: { 'content-type': type } });

/** Drives onopen the way the library does: a throw goes to onerror. */
async function open(opts: Opts, res: Response): Promise<void> {
  try {
    await opts.onopen(res);
  } catch (e) {
    try {
      opts.onerror(e);
    } catch {
      /* rethrown by design */
    }
  }
}

function makeHandlers(): BillEventHandlers {
  return {
    onOpen: vi.fn(),
    onReconnected: vi.fn(),
    onEvent: vi.fn(),
    onForbidden: vi.fn(),
  };
}

const msg = (
  event: string,
  data: string
): { id: string; event: string; data: string } => ({
  id: '',
  event,
  data,
});

/** Drives onclose then onerror the way the library does. */
function close(opts: Opts): void {
  try {
    opts.onclose();
  } catch (e) {
    expect(() => opts.onerror(e)).toThrow();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  token = 'tok-1';
  calls.length = 0;
  vi.mocked(fetchEventSource).mockReset();
  vi.mocked(fetchEventSource).mockImplementation((_url, opts) => {
    calls.push(opts as Opts);
    return new Promise<void>(() => undefined);
  });
  vi.mocked(refreshAccessToken).mockReset();
  vi.mocked(signOut).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('listenBillEvents', () => {
  it('sends the current token in the Authorization header and none in the URL', () => {
    listenBillEvents('h 1', makeHandlers());
    const url = vi.mocked(fetchEventSource).mock.calls[0]?.[0] as string;
    expect(url).toBe('http://api.test/households/h%201/bills/events');
    expect(url).not.toContain('tok-1');
    expect(at(0).headers).toEqual({ Authorization: 'Bearer tok-1' });
    expect(at(0).openWhenHidden).toBe(true);
  });

  it('ignores ping and empty data; parses and forwards item.done', async () => {
    const h = makeHandlers();
    listenBillEvents('h', h);
    await open(at(0), sseResponse());
    at(0).onmessage(msg('ping', 'x'));
    at(0).onmessage(msg('item.done', ''));
    expect(h.onEvent).not.toHaveBeenCalled();
    at(0).onmessage(msg('item.done', '{"batch_id":"b1"}'));
    expect(h.onEvent).toHaveBeenCalledWith('item.done', { batch_id: 'b1' });
  });

  it('ignores a message whose data is not JSON', async () => {
    const h = makeHandlers();
    listenBillEvents('h', h);
    await open(at(0), sseResponse());
    expect(() => at(0).onmessage(msg('item.done', '{oops'))).not.toThrow();
    expect(h.onEvent).not.toHaveBeenCalled();
  });

  it('calls onOpen on every open and onReconnected only from the second open', async () => {
    const h = makeHandlers();
    listenBillEvents('h', h);
    await open(at(0), sseResponse());
    expect(h.onOpen).toHaveBeenCalledTimes(1);
    expect(h.onReconnected).not.toHaveBeenCalled();
    close(at(0));
    vi.advanceTimersByTime(2000);
    expect(calls).toHaveLength(2);
    await open(at(1), sseResponse());
    expect(h.onOpen).toHaveBeenCalledTimes(2);
    expect(h.onReconnected).toHaveBeenCalledTimes(1);
  });

  it('on 401 refreshes and starts a new fetchEventSource call with the new token', async () => {
    vi.mocked(refreshAccessToken).mockImplementation(() => {
      token = 'tok-2';
      return Promise.resolve();
    });
    listenBillEvents('h', makeHandlers());
    await open(at(0), sseResponse(401, 'application/json'));
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(2000);
    expect(calls).toHaveLength(2);
    expect(at(1).headers).toEqual({ Authorization: 'Bearer tok-2' });
  });

  it('on 401 whose refresh rejects with 401 calls signOut and stops', async () => {
    vi.mocked(refreshAccessToken).mockRejectedValue(new ApiError(401, null));
    listenBillEvents('h', makeHandlers());
    await open(at(0), sseResponse(401, 'application/json'));
    expect(signOut).toHaveBeenCalledWith('expired');
    vi.advanceTimersByTime(600_000);
    expect(calls).toHaveLength(1);
  });

  it('on 401 whose refresh fails otherwise reconnects after 2 s', async () => {
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('network'));
    listenBillEvents('h', makeHandlers());
    await open(at(0), sseResponse(401, 'application/json'));
    expect(signOut).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(calls).toHaveLength(2);
  });

  it('on 403 calls onForbidden and does not reconnect', async () => {
    const h = makeHandlers();
    listenBillEvents('h', h);
    await open(at(0), sseResponse(403, 'application/json'));
    expect(h.onForbidden).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(600_000);
    expect(calls).toHaveLength(1);
  });

  it('on 503 retries after 30 s, then 60 s', async () => {
    listenBillEvents('h', makeHandlers());
    await open(at(0), sseResponse(503, 'application/json'));
    vi.advanceTimersByTime(29_999);
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(calls).toHaveLength(2);
    await open(at(1), sseResponse(503, 'application/json'));
    vi.advanceTimersByTime(59_999);
    expect(calls).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(calls).toHaveLength(3);
  });

  it('caps the backoff at 300 s and resets it after a successful open', async () => {
    listenBillEvents('h', makeHandlers());
    for (const ms of [30_000, 60_000, 120_000, 240_000, 300_000, 300_000]) {
      const n = calls.length;
      await open(at(n - 1), sseResponse(500, 'application/json'));
      vi.advanceTimersByTime(ms - 1);
      expect(calls).toHaveLength(n);
      vi.advanceTimersByTime(1);
      expect(calls).toHaveLength(n + 1);
    }
    await open(at(calls.length - 1), sseResponse());
    close(at(calls.length - 1));
    vi.advanceTimersByTime(2000);
    const n = calls.length;
    await open(at(n - 1), sseResponse(500, 'application/json'));
    vi.advanceTimersByTime(30_000);
    expect(calls).toHaveLength(n + 1);
  });

  it('treats a 2xx without text/event-stream as a server error', async () => {
    listenBillEvents('h', makeHandlers());
    await open(at(0), sseResponse(200, 'text/html'));
    vi.advanceTimersByTime(29_999);
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(calls).toHaveLength(2);
  });

  it('onclose reconnects after 2 s', () => {
    listenBillEvents('h', makeHandlers());
    close(at(0));
    vi.advanceTimersByTime(1999);
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(calls).toHaveLength(2);
  });

  it('a network error reconnects after 2 s', () => {
    listenBillEvents('h', makeHandlers());
    expect(() => at(0).onerror(new TypeError('Failed to fetch'))).toThrow();
    vi.advanceTimersByTime(2000);
    expect(calls).toHaveLength(2);
  });

  it('the returned function aborts and cancels a pending reconnect', async () => {
    const stop = listenBillEvents('h', makeHandlers());
    const signal = at(0).signal as AbortSignal | undefined;
    await open(at(0), sseResponse(500, 'application/json'));
    stop();
    expect(signal?.aborted).toBe(true);
    vi.advanceTimersByTime(600_000);
    expect(calls).toHaveLength(1);
  });

  it('does not reconnect from a rejection that settles after abort', async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue(undefined);
    const stop = listenBillEvents('h', makeHandlers());
    const pending = open(at(0), sseResponse(401, 'application/json'));
    stop();
    await pending;
    vi.advanceTimersByTime(600_000);
    expect(calls).toHaveLength(1);
  });
});
