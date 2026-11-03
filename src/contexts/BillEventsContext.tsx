import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { ApiError } from '@/auth/apiError';
import { ToastAction } from '@/components/ui/toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  useActiveHouseholdId,
  useHouseholds,
} from '@/contexts/HouseholdContext';
import { toast } from '@/hooks/use-toast';
import {
  BillEventsContext,
  batchKey,
  useTrackedBatches,
  type TrackBatchFn,
} from '@/hooks/useBillBatch';
import { applyBatchEvent } from '@/pages/bills/applyBatchEvent';
import { listenBillEvents } from '@/pages/bills/billEvents';
import { useBillBatchStore } from '@/stores/billBatchStore';
import type {
  BatchCompletedData,
  BillBatch,
  BillEventData,
  BillEventType,
} from '@/types/bills';

const BUFFER_MAX = 50;
const WAIT_FOR_OPEN_MS = 3000;

interface Buffered {
  seq: number;
  type: BillEventType;
  data: BillEventData;
}

/** Events for batches not yet tracked or cached, at most 50 in total. */
class EventBuffer {
  private readonly byBatch = new Map<string, Buffered[]>();
  private seq = 0;
  private size = 0;

  push(type: BillEventType, data: BillEventData): void {
    const list = this.byBatch.get(data.batch_id) ?? [];
    list.push({ seq: this.seq++, type, data });
    this.byBatch.set(data.batch_id, list);
    this.size += 1;
    while (this.size > BUFFER_MAX) this.dropOldest();
  }

  take(batchId: string): Buffered[] {
    const list = this.byBatch.get(batchId) ?? [];
    this.byBatch.delete(batchId);
    this.size -= list.length;
    return list;
  }

  clear(): void {
    this.byBatch.clear();
    this.size = 0;
  }

  private dropOldest(): void {
    let oldest: Buffered[] | undefined;
    let oldestId = '';
    for (const [id, list] of this.byBatch) {
      const head = list[0];
      if (head && (!oldest?.[0] || head.seq < oldest[0].seq)) {
        oldest = list;
        oldestId = id;
      }
    }
    if (!oldest) return;
    oldest.shift();
    this.size -= 1;
    if (oldest.length === 0) this.byBatch.delete(oldestId);
  }
}

/** Tracks whether the current stream is open; waiters resolve on open. */
class OpenGate {
  private isOpen = false;
  private readonly waiters = new Set<() => void>();

  wait(timeoutMs = WAIT_FOR_OPEN_MS): Promise<void> {
    if (this.isOpen) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = (): void => {
        clearTimeout(timer);
        this.waiters.delete(done);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      this.waiters.add(done);
    });
  }

  open(): void {
    this.isOpen = true;
    for (const done of [...this.waiters]) done();
  }

  reset(): void {
    this.isOpen = false;
  }
}

interface Latest {
  queryClient: QueryClient;
  userId: string | null;
  handleForbidden: (err?: unknown) => Promise<void>;
  t: TFunction;
}

/** A throw inside an SSE handler would turn into a reconnect loop. */
function safe(fn: () => void): void {
  try {
    fn();
  } catch {
    // swallowed on purpose
  }
}

function showCompletedToast(t: TFunction, c: BatchCompletedData): void {
  const label = t('bills:batch.reviewFailed');
  toast({
    title: t('bills:batch.completedToast', { done: c.done, total: c.total }),
    ...(c.failed > 0
      ? {
          action: (
            <ToastAction altText={label} asChild>
              <Link to="/bills/drafts#failed">{label}</Link>
            </ToastAction>
          ),
        }
      : {}),
  });
}

/** Patches a tracked, cached batch. Returns false when it can't. */
function applyTracked(
  latest: Latest,
  hid: string,
  type: BillEventType,
  data: BillEventData
): boolean {
  const store = useBillBatchStore.getState();
  const id = data.batch_id;
  const key = batchKey(hid, id);
  const cached = latest.queryClient.getQueryData<BillBatch>(key);
  const tracked = store.batches.some((b) => b.batchId === id);
  if (!tracked || !cached) return false;

  const { batch, waiting } = applyBatchEvent(cached, type, data);
  latest.queryClient.setQueryData(key, batch);
  if (waiting.set !== undefined || waiting.clear !== undefined) {
    store.setWaiting(id, waiting);
  }
  if (type === 'batch.completed') {
    const c = data as BatchCompletedData;
    if (latest.userId !== null && c.created_by_user_id === latest.userId) {
      showCompletedToast(latest.t, c);
    }
    store.markUnseen(id);
  }
  return true;
}

function routeEvent(
  latest: Latest,
  buffer: EventBuffer,
  hid: string,
  type: BillEventType,
  data: BillEventData
): void {
  if (type !== 'item.processing') {
    void latest.queryClient.invalidateQueries({
      queryKey: ['households', hid, 'bills', 'drafts'],
    });
  }
  if (!applyTracked(latest, hid, type, data)) buffer.push(type, data);
}

function refetchRunning(latest: Latest, hid: string): void {
  for (const b of useBillBatchStore.getState().batches) {
    if (b.hid !== hid) continue;
    const key = batchKey(hid, b.batchId);
    const cached = latest.queryClient.getQueryData<BillBatch>(key);
    if (cached?.completed !== true) {
      void latest.queryClient.invalidateQueries({ queryKey: key });
    }
  }
}

export function BillEventsProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const hid = useActiveHouseholdId();
  const { handleForbidden } = useHouseholds();
  const { t } = useTranslation();
  const userId = user?.id ?? null;

  const latest = useRef<Latest>({ queryClient, userId, handleForbidden, t });
  useLayoutEffect(() => {
    latest.current = { queryClient, userId, handleForbidden, t };
  });
  const [buffer] = useState(() => new EventBuffer());
  const [gate] = useState(() => new OpenGate());

  // Restore once signed in; clear everything on sign-out.
  const wasAuthenticated = useRef(false);
  useEffect(() => {
    const store = useBillBatchStore.getState();
    if (isAuthenticated && !wasAuthenticated.current) store.restore();
    if (!isAuthenticated && wasAuthenticated.current) {
      store.clear();
      buffer.clear();
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated, buffer]);

  // One stream per hid; only hid or sign-in state reopens it.
  useEffect(() => {
    if (!isAuthenticated || !hid) return;
    gate.reset();
    const stop = listenBillEvents(hid, {
      onOpen: () => safe(() => gate.open()),
      onReconnected: () => safe(() => refetchRunning(latest.current, hid)),
      onEvent: (type, data) =>
        safe(() => routeEvent(latest.current, buffer, hid, type, data)),
      onForbidden: () =>
        safe(() => {
          latest.current.handleForbidden().catch(() => undefined);
        }),
    });
    return () => {
      gate.reset();
      stop();
    };
  }, [hid, isAuthenticated, buffer, gate]);

  // A batch that is gone (404) or no longer ours (403) leaves the store.
  const tracked = useTrackedBatches(isAuthenticated ? hid : null);
  useEffect(() => {
    for (const { tracked: b, query } of tracked) {
      const err = query.error;
      if (
        err instanceof ApiError &&
        (err.status === 404 || err.status === 403)
      ) {
        useBillBatchStore.getState().dismiss(b.batchId);
      }
    }
  }, [tracked]);

  const trackBatch = useCallback<TrackBatchFn>(
    (batch, batchHid, thumbnails) => {
      queryClient.setQueryData(batchKey(batchHid, batch.batch_id), batch);
      useBillBatchStore.getState().track(batch, batchHid, thumbnails);
      for (const e of buffer.take(batch.batch_id)) {
        safe(() => applyTracked(latest.current, batchHid, e.type, e.data));
      }
    },
    [queryClient, buffer]
  );

  const value = useMemo(
    () => ({ waitForOpen: (ms?: number) => gate.wait(ms), trackBatch }),
    [gate, trackBatch]
  );

  return (
    <BillEventsContext.Provider value={value}>
      {children}
    </BillEventsContext.Provider>
  );
}
