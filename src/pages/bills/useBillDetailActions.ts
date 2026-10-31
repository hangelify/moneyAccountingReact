// src/pages/bills/useBillDetailActions.ts
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useBillDetail } from '@/hooks/useBillDetail';
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@/auth/apiError';
import { isHouseholdForbidden } from '@/auth/isHouseholdForbidden';
import type { BillDetailResponseDto } from '@/types/bills';
import { billsApi } from './api';
import {
  buildDetailConfirmPayload,
  isDraftValid,
  toDraft,
  type BillDetailDraft,
} from './billDetailDraft';

export interface BillDetailActions {
  bill: BillDetailResponseDto | undefined;
  // Non-null while in edit mode.
  draft: BillDetailDraft | null;
  setDraft: (draft: BillDetailDraft) => void;
  toggleEdit: () => void;
  confirm: () => void;
  isConfirming: boolean;
  canConfirm: boolean;
  // Back to the parent list, keeping its filters.
  close: () => void;
}

// Edit and confirm state shared by the detail drawer and the detail page.
export function useBillDetailActions(
  id: string | undefined
): BillDetailActions {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(['bills', 'errors']);
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
      void queryClient.invalidateQueries({
        queryKey: ['households', hid, 'dashboard'],
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
        void queryClient.invalidateQueries({
          queryKey: ['households', hid, 'dashboard'],
        });
        toast({ title: t('review.alreadyConfirmed') });
      } else if (status === 404) {
        void queryClient.invalidateQueries({
          queryKey: ['households', hid, 'bills'],
        });
        void queryClient.invalidateQueries({
          queryKey: ['households', hid, 'dashboard'],
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

  const setDraft = (next: BillDetailDraft): void => {
    if (id) setEdit({ id, draft: next });
  };

  const toggleEdit = (): void => {
    if (!id || !bill) return;
    setEdit(draft ? null : { id, draft: toDraft(bill) });
  };

  const canConfirm =
    hid !== null &&
    !confirmMutation.isPending &&
    (draft === null || isDraftValid(draft));

  return {
    bill,
    draft,
    setDraft,
    toggleEdit,
    confirm: () => confirmMutation.mutate(),
    isConfirming: confirmMutation.isPending,
    canConfirm,
    close,
  };
}
