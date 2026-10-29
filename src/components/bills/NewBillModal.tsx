import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { BillPhotoDropzone } from './BillPhotoDropzone';
import { billsApi } from '@/pages/bills/api';
import { validateBillImage } from '@/lib/imageValidation';
import { useBillDraftStore } from '@/stores/billDraftStore';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@/auth/apiError';
import { tokenStorage } from '@/auth/tokenStorage';
import { useAuth } from '@/contexts/AuthContext';
import { useHouseholds } from '@/contexts/HouseholdContext';
import { toParsePhotoFailure } from '@/pages/bills/parsePhotoError';
import { HouseholdSelect } from './HouseholdSelect';

// Module-level so they survive closing and reopening the modal. A rate limit
// keeps counting down, and "not available" lasts until a page reload.
let retryUntil: number | null = null;
let scanDisabled = false;

export function __resetNewBillModalState(): void {
  retryUntil = null;
  scanDisabled = false;
}

function secondsUntil(deadline: number | null): number {
  return deadline === null
    ? 0
    : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

interface SendVars {
  file: File;
  hid: string;
  /** Per request, so a late reply can tell it was aborted. */
  controller: AbortController;
}

interface NewBillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewBillModal({
  open,
  onOpenChange,
}: NewBillModalProps): ReactElement {
  const { t } = useTranslation(['bills', 'common', 'errors', 'households']);
  const navigate = useNavigate();
  const {
    status,
    households,
    activeHousehold,
    setActiveHouseholdId,
    handleForbidden,
    refetch,
  } = useHouseholds();
  const hid = status === 'ready' ? (activeHousehold?.id ?? null) : null;
  const setDraft = useBillDraftStore((s) => s.setDraft);
  const userId = useAuth().user?.id ?? null;

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    secondsUntil(retryUntil)
  );
  const [unavailable, setUnavailable] = useState(scanDisabled);
  const abortRef = useRef<AbortController | null>(null);

  // A scan must not outlive the modal or the session that started it.
  useEffect(() => () => abortRef.current?.abort(), []);
  // A different user doesn't inherit the rate limit or "not available".
  const lastUserId = useRef(userId);
  useEffect(() => {
    if (lastUserId.current === userId) return;
    lastUserId.current = userId;
    abortRef.current?.abort();
    __resetNewBillModalState();
  }, [userId]);
  const [shownUserId, setShownUserId] = useState(userId);
  if (shownUserId !== userId) {
    setShownUserId(userId);
    setSecondsLeft(0);
    setUnavailable(false);
  }

  const counting = secondsLeft > 0;
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => {
      const left = secondsUntil(retryUntil);
      setSecondsLeft(left);
      if (left <= 0) retryUntil = null;
    }, 250);
    return () => clearInterval(id);
  }, [counting]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const resetLocal = (): void => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setClientError(null);
    setServerError(null);
  };

  const mutation = useMutation({
    mutationFn: async ({ file: f, hid: sendHid, controller }: SendVars) => {
      abortRef.current = controller;
      const parsed = await billsApi.parsePhoto(sendHid, f, {
        signal: controller.signal,
      });
      return { parsed, hid: sendHid };
    },
    onSuccess: ({ parsed, hid: sentHid }, { file: f, controller }) => {
      if (controller.signal.aborted) return;
      setDraft({ file: f, parsed, hid: sentHid, mode: 'confirm' });
      if (parsed.duplicate) {
        toast({ title: t('bills:newBillModal.duplicate') });
      }
      resetLocal();
      onOpenChange(false);
      void navigate('/bills/review');
    },
    onError: (err, { file: f, hid: sentHid, controller }) => {
      if (controller.signal.aborted) return;
      const failure = toParsePhotoFailure(err);
      const reference = (requestId: string | null): string | undefined =>
        requestId ? t('errors:reference', { requestId }) : undefined;
      switch (failure.kind) {
        case 'cancelled':
          return;
        case 'auth':
          // The interceptor has already tried a refresh. If that ended the
          // session (token cleared), AuthProvider redirects and shows the
          // session toast. Otherwise (refresh failed with a network/5xx error)
          // show the upload-failed toast and keep the photo.
          // tokenStorage is read rather than useAuth(): the sign-out event
          // fired synchronously, but React has not re-rendered yet here.
          if (!tokenStorage.getAccessToken()) {
            onOpenChange(false);
            return;
          }
          toast({ variant: 'destructive', title: t('errors:uploadFailed') });
          return;
        case 'forbidden':
          void handleForbidden(err);
          return;
        case 'bad-photo':
          setServerError(failure.message);
          return;
        case 'save-failed': {
          setDraft({
            file: f,
            parsed: failure.parsed,
            hid: sentHid,
            mode: 'create',
          });
          const description = reference(failure.requestId);
          toast({
            title: t('bills:newBillModal.saveFailedFallback'),
            ...(description ? { description } : {}),
          });
          resetLocal();
          onOpenChange(false);
          void navigate('/bills/review');
          return;
        }
        case 'retry-later':
          retryUntil = Date.now() + failure.retryAfterSec * 1000;
          setSecondsLeft(failure.retryAfterSec);
          toast({ variant: 'destructive', title: failure.message });
          return;
        case 'unavailable':
          scanDisabled = true;
          setUnavailable(true);
          toast({ variant: 'destructive', title: failure.message });
          return;
        case 'failed': {
          const noResponse =
            err instanceof ApiError && err.status === undefined;
          const title = failure.timedOut
            ? t('errors:recognitionTimeout')
            : noResponse
              ? t('errors:network')
              : failure.message || t('errors:recognitionFailed');
          const description = reference(failure.requestId);
          toast({
            variant: 'destructive',
            title,
            ...(description ? { description } : {}),
          });
          return;
        }
      }
    },
  });

  const handleFileSelected = (picked: File): void => {
    setServerError(null);
    const result = validateBillImage(picked);
    if (!result.ok) {
      setClientError(
        result.reason === 'file_too_large'
          ? t('bills:validation.fileTooLarge')
          : t('bills:validation.unsupportedFormat')
      );
      return;
    }
    setClientError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  };

  const attemptClose = (): void => {
    if (mutation.isPending) return;
    if (file) {
      setConfirmDiscard(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleDiscard = (): void => {
    setConfirmDiscard(false);
    resetLocal();
    onOpenChange(false);
  };

  const handleDialogOpenChange = (next: boolean): void => {
    if (next) {
      onOpenChange(true);
      return;
    }
    attemptClose();
  };

  const canSend =
    file !== null &&
    hid !== null &&
    !mutation.isPending &&
    secondsLeft <= 0 &&
    !unavailable;

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          className="relative"
          onInteractOutside={(e) => {
            if (mutation.isPending) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (mutation.isPending) e.preventDefault();
          }}
          hideCloseButton={mutation.isPending}
        >
          <DialogHeader>
            <DialogTitle>{t('bills:newBillModal.title')}</DialogTitle>
            <DialogDescription>
              {t('bills:newBillModal.description')}
            </DialogDescription>
          </DialogHeader>

          {households.length > 1 && activeHousehold && (
            <HouseholdSelect
              households={households}
              value={activeHousehold.id}
              onChange={setActiveHouseholdId}
              disabled={mutation.isPending}
            />
          )}
          {status === 'empty' && (
            <p className="text-sm text-muted-foreground">
              {t('bills:newBillModal.noHousehold')}
            </p>
          )}
          {status === 'error' && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <p className="font-medium text-destructive">
                {t('households:loadFailed')}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
              >
                {t('households:retry')}
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <BillPhotoDropzone
              file={file}
              previewUrl={previewUrl}
              clientError={clientError}
              disabled={mutation.isPending}
              onFileSelected={handleFileSelected}
              onClear={resetLocal}
            />
            {serverError && (
              <p className="text-sm font-medium text-destructive">
                {serverError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={attemptClose}
              disabled={mutation.isPending}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() =>
                file &&
                hid &&
                mutation.mutate({
                  file,
                  hid,
                  controller: new AbortController(),
                })
              }
              disabled={!canSend}
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {secondsLeft > 0
                ? t('bills:newBillModal.retryIn', { seconds: secondsLeft })
                : t('common:actions.send')}
            </Button>
          </DialogFooter>

          {mutation.isPending && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/70 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="px-6 text-center text-sm font-medium">
                {t('bills:newBillModal.pending')}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => abortRef.current?.abort()}
              >
                {t('bills:newBillModal.cancelUpload')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={t('bills:newBillModal.discardTitle')}
        description={t('bills:newBillModal.discardDescription')}
        confirmLabel={t('common:actions.discard')}
        variant="destructive"
        onConfirm={handleDiscard}
      />
    </>
  );
}
