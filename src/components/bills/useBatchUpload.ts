import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { billsApi } from '@/pages/bills/api';
import { toBatchUploadFailure } from '@/pages/bills/batchUploadError';
import { useBillEventsReady, useTrackBatch } from '@/hooks/useBillBatch';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@/auth/apiError';
import { tokenStorage } from '@/auth/tokenStorage';
import { prepareBillImage } from '@/lib/resizeImage';
import { validateBillImage } from '@/lib/imageValidation';
import type { BillBatch } from '@/types/bills';
import type { SelectedPhoto } from './BillPhotoDropzone';

/** 503 busy: at most this many requests in total, waits doubling in between. */
const BUSY_MAX_ATTEMPTS = 3;

export interface BatchVars {
  files: File[];
  hid: string;
  controller: AbortController;
  /** Preview URLs by 0-based position; they move to the batch store on success. */
  thumbnails: Record<number, string>;
}

export interface BatchUploadHandlers {
  /** The batch was accepted. Reset without revoking the thumbnails, then close. */
  onSent: () => void;
  /** The session ended while uploading. */
  onSessionEnded: () => void;
  onForbidden: (err: unknown) => void;
  /** Sets the error of photos by 0-based index. */
  markPhotos: (errors: Map<number, string>) => void;
  /** A message under the photos. */
  showError: (message: string) => void;
  startCountdown: (retryAfterSec: number) => void;
  disableScan: () => void;
  /** Batch upload is off for the session: back to one photo. */
  onDisabled: () => void;
}

/**
 * Resizes every photo, then checks it again. Errors are keyed by 0-based
 * index; the photos are sent only when there are none.
 */
export async function preparePhotos(
  photos: SelectedPhoto[],
  t: TFunction
): Promise<{ prepared: File[]; errors: Map<number, string> }> {
  // One at a time: each resize decodes a full bitmap, and 20 at once can
  // exhaust a phone's memory. Keeps selection order.
  const prepared: File[] = [];
  for (const photo of photos) {
    prepared.push(await prepareBillImage(photo.file));
  }
  const errors = new Map<number, string>();
  prepared.forEach((file, i) => {
    const result = validateBillImage(file);
    if (result.ok) return;
    errors.set(
      i,
      result.reason === 'file_too_large'
        ? t('bills:validation.fileTooLarge')
        : t('bills:validation.unsupportedFormat')
    );
  });
  return { prepared, errors };
}

function abortError(): Error {
  return Object.assign(new Error('aborted'), { name: 'AbortError' });
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = (): void => {
      clearTimeout(id);
      reject(abortError());
    };
    const id = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function useBatchUpload(handlers: BatchUploadHandlers): {
  send: (vars: BatchVars) => void;
  isPending: boolean;
  retrying: boolean;
} {
  const { t } = useTranslation(['bills', 'errors']);
  const waitForOpen = useBillEventsReady();
  const trackBatch = useTrackBatch();
  const [retrying, setRetrying] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({
      files,
      hid,
      controller,
    }: BatchVars): Promise<BillBatch> => {
      const { signal } = controller;
      await waitForOpen();
      let delaySec = 0;
      for (let attempt = 1; ; attempt++) {
        if (signal.aborted) throw abortError();
        try {
          return await billsApi.parsePhotos(hid, files, { signal });
        } catch (err) {
          const failure = toBatchUploadFailure(err);
          if (failure.kind !== 'busy' || attempt >= BUSY_MAX_ATTEMPTS) {
            throw err;
          }
          delaySec = attempt === 1 ? failure.retryAfterSec : delaySec * 2;
          setRetrying(true);
          try {
            await wait(delaySec * 1000, signal);
          } finally {
            setRetrying(false);
          }
        }
      }
    },
    onSuccess: (batch, { files, hid, controller, thumbnails }) => {
      if (controller.signal.aborted) return;
      trackBatch(batch, hid, thumbnails);
      handlers.onSent();
      toast({ title: t('bills:batch.started', { count: files.length }) });
    },
    onError: (err, { files, controller }) => {
      if (controller.signal.aborted) return;
      const failure = toBatchUploadFailure(err);
      switch (failure.kind) {
        case 'cancelled':
          return;
        case 'auth':
          // As in the single flow: tokenStorage, because React has not
          // re-rendered after the sign-out event yet.
          if (!tokenStorage.getAccessToken()) {
            handlers.onSessionEnded();
            return;
          }
          toast({ variant: 'destructive', title: t('errors:uploadFailed') });
          return;
        case 'forbidden':
          handlers.onForbidden(err);
          return;
        case 'bad-file':
          if (failure.fileIndex !== null && failure.fileIndex < files.length) {
            handlers.markPhotos(
              new Map([[failure.fileIndex, failure.message]])
            );
          } else {
            handlers.showError(failure.message);
          }
          return;
        case 'retry-later':
        case 'busy': // retries used up
          handlers.startCountdown(failure.retryAfterSec);
          handlers.showError(t('bills:batch.fewerPhotos'));
          return;
        case 'budget':
          handlers.disableScan();
          toast({ variant: 'destructive', title: failure.message });
          return;
        case 'disabled':
          handlers.onDisabled();
          toast({ variant: 'destructive', title: t('bills:batch.disabled') });
          return;
        case 'failed': {
          const noResponse =
            err instanceof ApiError && err.status === undefined;
          const title = failure.timedOut
            ? t('errors:recognitionTimeout')
            : noResponse
              ? t('errors:network')
              : failure.message || t('errors:recognitionFailed');
          toast({
            variant: 'destructive',
            title,
            ...(failure.requestId
              ? {
                  description: t('errors:reference', {
                    requestId: failure.requestId,
                  }),
                }
              : {}),
          });
          return;
        }
      }
    },
  });

  return {
    send: (vars) => mutation.mutate(vars),
    isPending: mutation.isPending,
    retrying,
  };
}
