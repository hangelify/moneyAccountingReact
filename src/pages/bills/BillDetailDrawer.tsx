// src/pages/bills/BillDetailDrawer.tsx
import { useState, type ReactElement } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useBillDetail } from '@/hooks/useBillDetail';
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@/auth/apiError';
import { isHouseholdForbidden } from '@/auth/isHouseholdForbidden';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { billsApi } from './api';
import {
  buildDetailConfirmPayload,
  isDraftValid,
  toDraft,
  type BillDetailDraft,
} from './billDetailDraft';
import { BillDetailContent } from './components/BillDetailContent';

export function BillDetailDrawer(): ReactElement | null {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(['bills', 'errors']);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const hid = useActiveHouseholdId();
  const queryClient = useQueryClient();
  const bill = useBillDetail(id).data;
  // Keyed by bill id so opening another bill leaves edit mode.
  const [edit, setEdit] = useState<{
    id: string;
    draft: BillDetailDraft;
  } | null>(null);
  const draft = edit !== null && edit.id === id ? edit.draft : null;

  const close = (): void => {
    void navigate({ pathname: '..', search: location.search });
  };

  const confirmMutation = useMutation({
    mutationFn: () =>
      billsApi.confirm(
        hid!,
        bill!.id,
        buildDetailConfirmPayload(bill!, draft ?? toDraft(bill!))
      ),
    onSuccess: (confirmed) => {
      queryClient.setQueryData(['households', hid, 'bill', id], confirmed);
      void queryClient.invalidateQueries({
        queryKey: ['households', hid, 'bills'],
      });
      // A confirm can create a market.
      void queryClient.invalidateQueries({
        queryKey: ['households', hid, 'markets'],
      });
      setEdit(null);
      toast({ title: t('confirmed.detail.confirmed') });
    },
    onError: (err) => {
      // The household provider handles 403 for every mutation.
      if (isHouseholdForbidden(err)) return;
      const status = err instanceof ApiError ? err.status : undefined;
      if (status === 409) {
        // Confirmed elsewhere: show the saved bill rather than an error.
        setEdit(null);
        void queryClient.invalidateQueries({
          queryKey: ['households', hid, 'bill', id],
        });
        void queryClient.invalidateQueries({
          queryKey: ['households', hid, 'bills'],
        });
        toast({ title: t('review.alreadyConfirmed') });
      } else if (status === 404) {
        void queryClient.invalidateQueries({
          queryKey: ['households', hid, 'bills'],
        });
        toast({ variant: 'destructive', title: t('review.draftGone') });
        close();
      } else if (status === 400 && err instanceof ApiError) {
        toast({
          variant: 'destructive',
          title: t('confirmed.detail.confirmFailed'),
          description: err.messages.join('\n'),
        });
      } else {
        toast({ variant: 'destructive', title: t('errors:saveFailed') });
      }
    },
  });

  if (!id) return null;

  const handleOpenChange = (next: boolean): void => {
    if (!next) close();
  };

  const canConfirm =
    hid !== null &&
    !confirmMutation.isPending &&
    (draft === null || isDraftValid(draft));

  return (
    <Sheet open onOpenChange={handleOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        // Only the bottom sheet is capped; the side sheet spans full height.
        className={cn(
          'flex flex-col gap-4 overflow-y-auto sm:max-w-md',
          !isDesktop && 'max-h-[90vh]'
        )}
      >
        <SheetHeader>
          <SheetTitle>{t('confirmed.detail.title')}</SheetTitle>
          {bill && (
            <div className="flex gap-2 pr-6">
              {bill.status === 'draft' && (
                <Button
                  size="sm"
                  disabled={!canConfirm}
                  onClick={() => confirmMutation.mutate()}
                >
                  {t('confirmed.detail.confirm')}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={confirmMutation.isPending}
                onClick={() =>
                  setEdit(draft ? null : { id, draft: toDraft(bill) })
                }
              >
                {draft
                  ? t('confirmed.detail.cancel')
                  : t('confirmed.detail.edit')}
              </Button>
            </div>
          )}
        </SheetHeader>
        <BillDetailContent
          id={id}
          draft={draft}
          onDraftChange={(next) => setEdit({ id, draft: next })}
        />
        {bill && (
          // Remove is wired in a follow-up; disabled until then.
          <Button variant="destructive" className="mt-auto w-full" disabled>
            {t('confirmed.detail.remove')}
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
