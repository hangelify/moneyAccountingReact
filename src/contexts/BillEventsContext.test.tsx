import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { BillEventsProvider } from './BillEventsContext';
import {
  batchKey,
  useBillEventsReady,
  useTrackBatch,
} from '@/hooks/useBillBatch';
import {
  useBillBatchStore,
  __resetBillBatchStore,
  type TrackedBatch,
} from '@/stores/billBatchStore';
import { billsApi } from '@/pages/bills/api';
import { ApiError } from '@/auth/apiError';
import { toast } from '@/hooks/use-toast';
import type * as ToastModule from '@/hooks/use-toast';
import type { BillEventHandlers } from '@/pages/bills/billEvents';
import type { BillBatch, BillEventData, BillEventType } from '@/types/bills';
import type { HouseholdContextValue } from '@/contexts/HouseholdContext';
import {
  HouseholdTestProvider,
  makeHouseholdValue,
  TEST_HOUSEHOLDS,
} from '@/test/household';

const streams = vi.hoisted(
  () => [] as { hid: string; h: BillEventHandlers; stop: () => void }[]
);
vi.mock('@/pages/bills/billEvents', () => ({
  listenBillEvents: vi.fn((hid: string, h: BillEventHandlers) => {
    const stop = vi.fn();
    streams.push({ hid, h, stop });
    return stop;
  }),
}));

vi.mock('@/hooks/use-toast', async (importOriginal) => {
  const actual = await importOriginal<typeof ToastModule>();
  return { ...actual, toast: vi.fn(actual.toast) };
});

const auth: { user: { id: string } | null } = { user: { id: 'u1' } };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.user, isAuthenticated: auth.user !== null }),
}));

const DRAFTS_KEY = ['households', 'hh-1', 'bills', 'drafts'];

function makeBatch(id: string, overrides: Partial<BillBatch> = {}): BillBatch {
  return {
    batch_id: id,
    created_at: '2026-11-03T10:00:00Z',
    total: 3,
    completed: false,
    items: [0, 1, 2].map((position) => ({
      id: `${id}-i${position}`,
      position,
      status: 'queued' as const,
      bill_id: null,
      parse_error_code: null,
      parse_error_message: null,
    })),
    ...overrides,
  };
}

function itemEvent(
  batchId: string,
  position: number,
  status: 'queued' | 'processing' | 'done' | 'failed',
  extra: Partial<BillEventData> = {}
): BillEventData {
  return {
    batch_id: batchId,
    item_id: `${batchId}-i${position}`,
    position,
    status,
    created_by_user_id: 'u1',
    ...extra,
  } as BillEventData;
}

let hooks: {
  ready: ReturnType<typeof useBillEventsReady>;
  track: ReturnType<typeof useTrackBatch>;
};
function Probe(): null {
  const ready = useBillEventsReady();
  const track = useTrackBatch();
  useEffect(() => {
    hooks = { ready, track };
  }, [ready, track]);
  return null;
}

interface Setup {
  qc: QueryClient;
  value: HouseholdContextValue;
  rerender: (v: HouseholdContextValue) => void;
  unmount: () => void;
}

function setup(value: HouseholdContextValue = makeHouseholdValue()): Setup {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (v: HouseholdContextValue): React.JSX.Element => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HouseholdTestProvider value={v}>
          <BillEventsProvider>
            <Probe />
            <Toaster />
          </BillEventsProvider>
        </HouseholdTestProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const r = render(ui(value));
  return {
    qc,
    value,
    rerender: (v: HouseholdContextValue) => r.rerender(ui(v)),
    unmount: r.unmount,
  };
}

function last(): (typeof streams)[number] {
  const s = streams[streams.length - 1];
  if (!s) throw new Error('no stream');
  return s;
}

function fire(type: BillEventType, data: BillEventData): void {
  act(() => last().h.onEvent(type, data));
}

function trackNow(batch: BillBatch): void {
  act(() => hooks.track(batch, 'hh-1', {}));
}

beforeEach(() => {
  streams.length = 0;
  auth.user = { id: 'u1' };
  __resetBillBatchStore();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('BillEventsProvider', () => {
  it('opens one stream for the active hid and closes it on unmount', () => {
    const { unmount, rerender, value } = setup();
    rerender({ ...value });
    expect(streams).toHaveLength(1);
    expect(last().hid).toBe('hh-1');
    unmount();
    expect(last().stop).toHaveBeenCalledTimes(1);
  });

  it('switching household reopens the stream for the new hid', () => {
    const { rerender } = setup();
    rerender(
      makeHouseholdValue({ activeHousehold: TEST_HOUSEHOLDS[1] ?? null })
    );
    expect(streams).toHaveLength(2);
    expect(streams[0]?.stop).toHaveBeenCalledTimes(1);
    expect(last().hid).toBe('hh-2');
  });

  it('item.done patches the tracked batch query and invalidates drafts', () => {
    const { qc } = setup();
    trackNow(makeBatch('b1'));
    const spy = vi.spyOn(qc, 'invalidateQueries');
    fire('item.done', itemEvent('b1', 1, 'done', { bill_id: 'bill-1' }));
    const cached = qc.getQueryData<BillBatch>(batchKey('hh-1', 'b1'));
    expect(cached?.items[1]?.status).toBe('done');
    expect(cached?.items[1]?.bill_id).toBe('bill-1');
    expect(spy).toHaveBeenCalledWith({ queryKey: DRAFTS_KEY });
  });

  it('processing→queued marks the position waiting in the store', () => {
    setup();
    trackNow(makeBatch('b1'));
    fire('item.processing', itemEvent('b1', 0, 'processing'));
    fire('item.processing', itemEvent('b1', 0, 'queued'));
    expect(useBillBatchStore.getState().batches[0]?.waiting).toEqual([0]);
  });

  it('batch.completed by me shows "2 of 3 receipts read" and marks unseen', async () => {
    setup();
    trackNow(makeBatch('b1'));
    fire('batch.completed', {
      batch_id: 'b1',
      total: 3,
      done: 2,
      failed: 1,
      created_by_user_id: 'u1',
    });
    expect(await screen.findByText('2 of 3 receipts read')).toBeInTheDocument();
    expect(screen.getByText('Review failed')).toHaveAttribute(
      'href',
      '/bills/drafts#failed'
    );
    expect(useBillBatchStore.getState().batches[0]?.unseen).toBe(true);
  });

  it('batch.completed by another user shows no toast but invalidates drafts', () => {
    const toastSpy = vi.mocked(toast);
    toastSpy.mockClear();
    const { qc } = setup();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    fire('batch.completed', {
      batch_id: 'b7',
      total: 3,
      done: 3,
      failed: 0,
      created_by_user_id: 'u2',
    });
    expect(toastSpy).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({ queryKey: DRAFTS_KEY });
  });

  it('onReconnected invalidates only running batches', () => {
    const { qc } = setup();
    trackNow(makeBatch('run'));
    trackNow(makeBatch('fin', { completed: true }));
    const spy = vi.spyOn(qc, 'invalidateQueries');
    act(() => last().h.onReconnected());
    expect(spy).toHaveBeenCalledWith({ queryKey: batchKey('hh-1', 'run') });
    expect(spy).not.toHaveBeenCalledWith({
      queryKey: batchKey('hh-1', 'fin'),
    });
  });

  it('restores tracked batches from sessionStorage and fetches them', async () => {
    const stored: TrackedBatch = {
      batchId: 'b1',
      hid: 'hh-1',
      createdAt: '2026-11-03T10:00:00Z',
      thumbnails: {},
      waiting: [],
      unseen: false,
    };
    sessionStorage.setItem('billBatches', JSON.stringify([stored]));
    const api = vi.spyOn(billsApi, 'batch').mockResolvedValue(makeBatch('b1'));
    const { qc } = setup();
    await waitFor(() =>
      expect(qc.getQueryData(batchKey('hh-1', 'b1'))).toEqual(makeBatch('b1'))
    );
    expect(api).toHaveBeenCalledWith('hh-1', 'b1');
    expect(useBillBatchStore.getState().batches).toHaveLength(1);
  });

  it('drops a tracked batch on 404', async () => {
    const stored: TrackedBatch = {
      batchId: 'gone',
      hid: 'hh-1',
      createdAt: '2026-11-03T10:00:00Z',
      thumbnails: {},
      waiting: [],
      unseen: false,
    };
    sessionStorage.setItem('billBatches', JSON.stringify([stored]));
    vi.spyOn(billsApi, 'batch').mockRejectedValue(new ApiError(404, {}));
    setup();
    await waitFor(() =>
      expect(useBillBatchStore.getState().batches).toEqual([])
    );
  });

  it('buffers events for an unknown batch until it is tracked', () => {
    const { qc } = setup();
    fire('item.done', itemEvent('b9', 2, 'done', { bill_id: 'bill-9' }));
    trackNow(makeBatch('b9'));
    const cached = qc.getQueryData<BillBatch>(batchKey('hh-1', 'b9'));
    expect(cached?.items[2]?.status).toBe('done');
    expect(cached?.items[2]?.bill_id).toBe('bill-9');
  });

  it('waitForOpen resolves on onOpen, or after 3000 ms', async () => {
    vi.useFakeTimers();
    setup();
    let first = false;
    void hooks.ready().then(() => (first = true));
    await vi.advanceTimersByTimeAsync(2999);
    expect(first).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(first).toBe(true);

    let second = false;
    void hooks.ready().then(() => (second = true));
    act(() => last().h.onOpen());
    await vi.advanceTimersByTimeAsync(0);
    expect(second).toBe(true);

    let third = false;
    void hooks.ready().then(() => (third = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(third).toBe(true);
  });

  it('sign-out clears the store', () => {
    const { rerender, value } = setup();
    trackNow(makeBatch('b1'));
    expect(useBillBatchStore.getState().batches).toHaveLength(1);
    auth.user = null;
    rerender({ ...value });
    expect(useBillBatchStore.getState().batches).toEqual([]);
    expect(last().stop).toHaveBeenCalledTimes(1);
  });
});
