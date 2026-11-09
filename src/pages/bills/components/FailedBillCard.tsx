import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@/auth/apiError';
import {
  useActiveHouseholdId,
  useHouseholds,
} from '@/contexts/HouseholdContext';
import { useBillImage } from '@/hooks/useBillImage';
import { useTrackBatch } from '@/hooks/useBillBatch';
import type { DraftBillDto } from '@/types/bills';
import { billsApi } from '../api';
import { toBatchUploadFailure } from '../batchUploadError';

const BUDGET_PREFIX = 'Daily AI budget';

export function FailedBillCard({ bill }: { bill: DraftBillDto }): ReactElement {
  const { t } = useTranslation('bills');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hid = useActiveHouseholdId();
  const { handleForbidden } = useHouseholds();
  const trackBatch = useTrackBatch();
  const image = useBillImage(bill.id);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const message = bill.parse_error_message ?? '';
  const code = bill.parse_error_code;
  const isBudget = code === 'ai_failed' && message.startsWith(BUDGET_PREFIX);
  const canRetry = code === 'ai_failed';

  const refresh = (): void => {
    void queryClient.invalidateQueries({
      queryKey: ['households', hid, 'bills', 'drafts'],
    });
  };

  const retry = useMutation({
    mutationFn: () => billsApi.retry(hid ?? '', bill.id),
    onSuccess: (batch) => {
      trackBatch(
        batch,
        hid ?? '',
        image.blob ? { 0: URL.createObjectURL(image.blob) } : {}
      );
      refresh();
      toast({ title: t('failed.retryStarted') });
    },
    onError: (err) => {
      const status = err instanceof ApiError ? err.status : undefined;
      if (status === 409 || status === 404) {
        refresh();
        toast({ title: t('failed.gone') });
        return;
      }
      if (status === 403) {
        void handleForbidden(err);
        return;
      }
      const failure = toBatchUploadFailure(err);
      if (failure.kind === 'cancelled') return;
      const message =
        'message' in failure ? failure.message : t('failed.retryFailed');
      toast({
        variant: 'destructive',
        title: message,
        description:
          failure.kind === 'retry-later' || failure.kind === 'busy'
            ? t('failed.retryIn', { seconds: failure.retryAfterSec })
            : undefined,
      });
    },
  });

  const remove = async (): Promise<void> => {
    try {
      await billsApi.remove(hid ?? '', bill.id);
      setConfirmOpen(false);
      refresh();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      if (status === 404) {
        setConfirmOpen(false);
        refresh();
      } else if (status === 403) {
        setConfirmOpen(false);
        void handleForbidden(err);
      } else {
        toast({
          variant: 'destructive',
          title: err instanceof Error ? err.message : t('failed.deleteFailed'),
        });
      }
    }
  };

  const enterManually = (
    <Button
      key="manual"
      size="sm"
      variant={canRetry && !isBudget ? 'outline' : 'default'}
      onClick={() => void navigate(`/bills/drafts/${bill.id}`)}
    >
      {t('failed.enterManually')}
    </Button>
  );
  const retryButton = (
    <Button
      key="retry"
      size="sm"
      variant={isBudget ? 'outline' : 'default'}
      disabled={isBudget || retry.isPending || hid === null}
      onClick={() => retry.mutate()}
    >
      {isBudget ? t('failed.retryTomorrow') : t('failed.retry')}
    </Button>
  );

  return (
    <li className="flex gap-3 rounded-lg border bg-card p-3">
      {image.url ? (
        <button
          type="button"
          onClick={() => setPhotoOpen(true)}
          className="h-16 w-16 shrink-0 overflow-hidden rounded-md"
        >
          <img
            src={image.url}
            alt={t('failed.photoAlt')}
            className="h-16 w-16 object-cover"
          />
        </button>
      ) : (
        <div
          data-testid="failed-thumb-placeholder"
          className="h-16 w-16 shrink-0 rounded-md bg-muted"
          aria-hidden="true"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          {new Date(bill.created_at).toLocaleDateString()}
        </p>
        <p className="text-sm">{message}</p>
        <div className="flex flex-wrap gap-2">
          {canRetry && !isBudget ? (
            <>
              {retryButton}
              {enterManually}
            </>
          ) : (
            <>
              {enterManually}
              {isBudget && retryButton}
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            {t('failed.delete')}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('failed.deleteTitle')}
        description={t('failed.deleteDescription')}
        confirmLabel={t('failed.delete')}
        variant="destructive"
        onConfirm={remove}
      />
      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent>
          <DialogTitle className="sr-only">{t('failed.photoAlt')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('failed.photoAlt')}
          </DialogDescription>
          {image.url && (
            <img
              src={image.url}
              alt={t('failed.photoAlt')}
              className="max-h-[80vh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </li>
  );
}
