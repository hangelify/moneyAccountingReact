import { createContext, useCallback, useContext, useMemo } from 'react';
import {
  useQueries,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { OWN_FORBIDDEN_META } from '@/contexts/HouseholdContext';
import { billsApi } from '@/pages/bills/api';
import { useBillBatchStore, type TrackedBatch } from '@/stores/billBatchStore';
import type { BillBatch } from '@/types/bills';

export const batchKey = (hid: string, id: string) =>
  ['households', hid, 'bill-batches', id] as const;

export type TrackBatchFn = (
  batch: BillBatch,
  hid: string,
  thumbnails: Record<number, string>
) => void;

export interface BillEventsContextValue {
  waitForOpen: (timeoutMs?: number) => Promise<void>;
  trackBatch: TrackBatchFn;
}

export const BillEventsContext = createContext<BillEventsContextValue | null>(
  null
);

export function useTrackedBatches(
  hid: string | null
): { tracked: TrackedBatch; query: UseQueryResult<BillBatch> }[] {
  const batches = useBillBatchStore((s) => s.batches);
  const mine = useMemo(
    () => (hid ? batches.filter((b) => b.hid === hid) : []),
    [batches, hid]
  );
  const queries = useQueries({
    queries: mine.map((t) => ({
      queryKey: batchKey(t.hid, t.batchId),
      queryFn: () => billsApi.batch(t.hid, t.batchId),
      staleTime: Infinity,
      retry: false,
      // A 403 only drops the batch (the provider dismisses it), spec §3.6.
      meta: OWN_FORBIDDEN_META,
    })),
  });
  return mine.flatMap((tracked, i) => {
    const query = queries[i];
    return query ? [{ tracked, query }] : [];
  });
}

const resolveNow = (): Promise<void> => Promise.resolve();

/** Without a provider (tests), uploads don't wait for a stream. */
export function useBillEventsReady(): (timeoutMs?: number) => Promise<void> {
  return useContext(BillEventsContext)?.waitForOpen ?? resolveNow;
}

/** Without a provider, seeds the query and the store, with no event replay. */
export function useTrackBatch(): TrackBatchFn {
  const ctx = useContext(BillEventsContext);
  const queryClient = useQueryClient();
  const fallback = useCallback<TrackBatchFn>(
    (batch, hid, thumbnails) => {
      queryClient.setQueryData(batchKey(hid, batch.batch_id), batch);
      useBillBatchStore.getState().track(batch, hid, thumbnails);
    },
    [queryClient]
  );
  return ctx?.trackBatch ?? fallback;
}
