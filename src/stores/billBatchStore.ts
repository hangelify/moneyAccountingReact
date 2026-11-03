import { create } from 'zustand';
import type { BillBatch } from '@/types/bills';
import type { WaitingChange } from '@/pages/bills/applyBatchEvent';

const STORAGE_KEY = 'billBatches';

export interface TrackedBatch {
  batchId: string;
  hid: string;
  createdAt: string;
  thumbnails: Record<number, string>; // object URLs, by position; empty after a reload
  waiting: number[]; // positions moved back to queued
  unseen: boolean; // completed and not yet opened in the bell
}

interface BillBatchState {
  batches: TrackedBatch[]; // newest first
  track: (
    b: BillBatch,
    hid: string,
    thumbnails: Record<number, string>
  ) => void;
  setWaiting: (batchId: string, change: WaitingChange) => void;
  markUnseen: (batchId: string) => void;
  markAllSeen: (hid: string) => void;
  dismiss: (batchId: string) => void;
  dismissCompleted: (hid: string, completedIds: string[]) => void;
  restore: () => void;
  clear: () => void;
}

function revokeAll(batches: TrackedBatch[]): void {
  for (const b of batches) {
    for (const url of Object.values(b.thumbnails)) URL.revokeObjectURL(url);
  }
}

function persist(batches: TrackedBatch[]): void {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(batches.map((b) => ({ ...b, thumbnails: {} })))
    );
  } catch {
    // storage unavailable; the in-memory store still works
  }
}

/** A stored element, or null when it lacks the string ids we need. */
function fromStorage(raw: unknown): TrackedBatch | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const { batchId, hid, createdAt, waiting, unseen } = r;
  if (
    typeof batchId !== 'string' ||
    typeof hid !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    return null;
  }
  return {
    batchId,
    hid,
    createdAt,
    thumbnails: {}, // object URLs don't survive a reload
    waiting: Array.isArray(waiting)
      ? waiting.filter((p): p is number => typeof p === 'number')
      : [],
    unseen: typeof unseen === 'boolean' ? unseen : false,
  };
}

function mutate(
  set: (partial: Partial<BillBatchState>) => void,
  get: () => BillBatchState,
  fn: (batches: TrackedBatch[]) => TrackedBatch[]
): void {
  const batches = fn(get().batches);
  set({ batches });
  persist(batches);
}

export const useBillBatchStore = create<BillBatchState>((set, get) => ({
  batches: [],

  track: (b, hid, thumbnails) => {
    if (get().batches.some((t) => t.batchId === b.batch_id)) return;
    mutate(set, get, (batches) => [
      {
        batchId: b.batch_id,
        hid,
        createdAt: b.created_at,
        thumbnails,
        waiting: [],
        unseen: false,
      },
      ...batches,
    ]);
  },

  setWaiting: (batchId, change) => {
    mutate(set, get, (batches) =>
      batches.map((t) => {
        if (t.batchId !== batchId) return t;
        let waiting = t.waiting;
        if (change.set !== undefined && !waiting.includes(change.set)) {
          waiting = [...waiting, change.set];
        }
        if (change.clear !== undefined) {
          waiting = waiting.filter((p) => p !== change.clear);
        }
        return { ...t, waiting };
      })
    );
  },

  markUnseen: (batchId) => {
    mutate(set, get, (batches) =>
      batches.map((t) => (t.batchId === batchId ? { ...t, unseen: true } : t))
    );
  },

  markAllSeen: (hid) => {
    mutate(set, get, (batches) =>
      batches.map((t) => (t.hid === hid ? { ...t, unseen: false } : t))
    );
  },

  dismiss: (batchId) => {
    revokeAll(get().batches.filter((t) => t.batchId === batchId));
    mutate(set, get, (batches) => batches.filter((t) => t.batchId !== batchId));
  },

  dismissCompleted: (hid, completedIds) => {
    const gone = (t: TrackedBatch): boolean =>
      t.hid === hid && completedIds.includes(t.batchId);
    revokeAll(get().batches.filter(gone));
    mutate(set, get, (batches) => batches.filter((t) => !gone(t)));
  },

  restore: () => {
    let batches: TrackedBatch[] = [];
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        batches = parsed.flatMap((raw) => {
          const b = fromStorage(raw);
          return b ? [b] : [];
        });
      }
    } catch {
      batches = [];
    }
    set({ batches });
  },

  clear: () => {
    revokeAll(get().batches);
    set({ batches: [] });
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
}));

export function __resetBillBatchStore(): void {
  useBillBatchStore.setState({ batches: [] });
}
