import { useEffect, useState, type ReactElement } from 'react';
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
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';

interface NewBillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewBillModal({
  open,
  onOpenChange,
}: NewBillModalProps): ReactElement {
  const { t } = useTranslation(['bills', 'common', 'errors']);
  const navigate = useNavigate();
  const hid = useActiveHouseholdId();
  const setDraft = useBillDraftStore((s) => s.setDraft);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

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
    mutationFn: async (f: File) => {
      if (!hid) throw new Error('No active household');
      return { parsed: await billsApi.parsePhoto(hid, f), hid };
    },
    onSuccess: ({ parsed, hid: sentHid }, f) => {
      setDraft({ file: f, parsed, hid: sentHid, mode: 'confirm' });
      resetLocal();
      onOpenChange(false);
      void navigate('/bills/review');
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setServerError(err.message);
          return;
        }
        // The interceptor has already tried a refresh. If that ended the
        // session (token cleared), AuthProvider redirects and shows the
        // session toast. Otherwise (refresh failed with a network/5xx error)
        // fall through to the upload-failed toast and keep the photo.
        // tokenStorage is read rather than useAuth(): the sign-out event
        // fired synchronously, but React has not re-rendered yet here.
        if (err.status === 401 && !tokenStorage.getAccessToken()) {
          onOpenChange(false);
          return;
        }
        if (err.status === 502) {
          const requestId =
            (err.body as { requestId?: string } | undefined)?.requestId ?? '';
          toast({
            variant: 'destructive',
            title: t('errors:aiUnavailable.title'),
            description: t('errors:aiUnavailable.description', { requestId }),
          });
          return;
        }
      }
      toast({
        variant: 'destructive',
        title: t('errors:uploadFailed'),
      });
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

  const canSend = file !== null && hid !== null && !mutation.isPending;

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
              onClick={() => file && mutation.mutate(file)}
              disabled={!canSend}
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('common:actions.send')}
            </Button>
          </DialogFooter>

          {mutation.isPending && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/70 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="px-6 text-center text-sm font-medium">
                {t('bills:newBillModal.pending')}
              </p>
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
