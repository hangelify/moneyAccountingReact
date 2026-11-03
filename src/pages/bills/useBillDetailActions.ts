// src/pages/bills/useBillDetailActions.ts
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useBillDetail } from '@/hooks/useBillDetail';
import { useDuplicateMutations } from '@/hooks/useDuplicateMutations';
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@/auth/apiError';
import { isHouseholdForbidden } from '@/auth/isHouseholdForbidden';
import type {
  BillDetailResponseDto,
  BillEdits,
  PossibleDuplicate,
  UpdateBillRequest,
} from '@/types/bills';
import { billsApi } from './api';
import {
  billToEdits,
  buildDetailConfirmPayload,
  buildDetailUpdatePayload,
  isEditsValid,
} from './billDetailEdits';

export interface BillDetailActions {
  bill: BillDetailResponseDto | undefined;
  // Non-null while the form is shown: always for a draft, after Edit for a
  // confirmed bill.
  edits: BillEdits | null;
  setEdits: (edits: BillEdits) => void;
  // Whether the form holds changes of the user's; a draft resets to the
  // loaded values only then.
  isEdited: boolean;
  // A receipt that could not be read: a draft with no lines and an error.
  isFailed: boolean;
  // Confirmed bill: Edit / Cancel. Draft: Reset.
  toggleEdit: () => void;
  confirm: () => void;
  isConfirming: boolean;
  canConfirm: boolean;
  // Sends only the edited fields; never changes the status.
  save: () => void;
  isSaving: boolean;
  canSave: boolean;
  // Deletes the bill for good (soft delete, no restore) and goes back to the
  // list. Resolves once the request settles, success or not.
  remove: () => Promise<void>;
  isRemoving: boolean;
  canRemove: boolean;
  // Back to the parent list, keeping its filters.
  close: () => void;
  // Drafts: the original chosen with Mark, sent as duplicate_of_id on Confirm.
  pendingDuplicateOf: PossibleDuplicate | null;
  markPending: (original: PossibleDuplicate) => void;
  undoPending: () => void;
  // Confirmed bills: act right away.
  markDuplicate: (original: PossibleDuplicate) => void;
  unmarkDuplicate: () => void;
  keepBoth: (other: PossibleDuplicate) => void;
  isDuplicateBusy: boolean;
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
    edits: BillEdits;
  } | null>(null);
  const isEdited = edit !== null && edit.id === id;
  const isFailed = bill?.status === 'failed';
  // A failed receipt is entered by hand, so it behaves as a draft.
  const isDraft = bill?.status === 'draft' || isFailed;
  // A draft is always in the form; without changes it shows the loaded bill.
  const edits = isEdited
    ? edit.edits
    : bill && isDraft
      ? billToEdits(bill)
      : null;
  // Keyed by bill id too, so a link never carries over to another draft.
  const [pending, setPending] = useState<{
    id: string;
    original: PossibleDuplicate;
  } | null>(null);
  const pendingDuplicateOf =
    pending !== null && pending.id === id ? pending.original : null;
  const duplicates = useDuplicateMutations(hid);

  const close = (): void => {
    void navigate({ pathname: '..', search: location.search });
  };

  const confirmMutation = useMutation({
    mutationFn: () =>
      billsApi.confirm(
        hid!,
        bill!.id,
        buildDetailConfirmPayload(
          bill!,
          edits ?? billToEdits(bill!),
          pendingDuplicateOf?.id ?? null
        )
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
      setPending(null);
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
      } else if (status === 404 && pendingDuplicateOf !== null) {
        // Most likely the original went away: drop the link, stay open, and
        // refetch so a deleted original leaves the banner.
        setPending(null);
        void queryClient.invalidateQueries({
          queryKey: ['households', hid, 'bill', id],
        });
        toast({
          variant: 'destructive',
          title: t('duplicates.errors.originalGone'),
        });
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

  const saveMutation = useMutation({
    mutationFn: (body: UpdateBillRequest) =>
      billsApi.update(hid!, bill!.id, body),
    onSuccess: (saved) => {
      queryClient.setQueryData(['households', hid, 'bill', id], saved);
      void queryClient.invalidateQueries({
        queryKey: ['households', hid, 'bills'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['households', hid, 'dashboard'],
      });
      // A new market name creates a market.
      void queryClient.invalidateQueries({
        queryKey: ['households', hid, 'markets'],
      });
      setEdit(null);
      toast({ title: t('confirmed.detail.saved') });
    },
    onError: (err) => {
      if (isHouseholdForbidden(err)) return;
      const status = err instanceof ApiError ? err.status : undefined;
      if (status === 404) {
        void queryClient.invalidateQueries({
          queryKey: ['households', hid, 'bills'],
        });
        void queryClient.invalidateQueries({
          queryKey: ['households', hid, 'dashboard'],
        });
        toast({ variant: 'destructive', title: t('confirmed.detail.gone') });
        close();
      } else if (status === 400 && err instanceof ApiError) {
        // Nothing was saved; the edits stay so the user can fix and retry.
        toast({
          variant: 'destructive',
          title: t('confirmed.detail.saveFailed'),
          description: err.messages.join('\n'),
        });
      } else {
        toast({ variant: 'destructive', title: t('errors:saveFailed') });
      }
    },
  });

  const invalidateBillLists = (): void => {
    // The bills prefix covers the list, drafts and duplicate suggestions.
    void queryClient.invalidateQueries({
      queryKey: ['households', hid, 'bills'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['households', hid, 'dashboard'],
    });
  };

  const removeMutation = useMutation({
    mutationFn: () => billsApi.remove(hid!, bill!.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['households', hid, 'bill', id] });
      invalidateBillLists();
      toast({ title: t('confirmed.detail.deleted') });
      close();
    },
    onError: (err) => {
      if (isHouseholdForbidden(err)) return;
      const status = err instanceof ApiError ? err.status : undefined;
      if (status === 404) {
        // Already gone (another member, another tab, draft cleanup): the
        // user got what they wanted.
        queryClient.removeQueries({
          queryKey: ['households', hid, 'bill', id],
        });
        invalidateBillLists();
        toast({ title: t('confirmed.detail.alreadyDeleted') });
        close();
      } else {
        // Nothing changed: the bill stays and the user can retry.
        toast({
          variant: 'destructive',
          title: t('confirmed.detail.deleteFailed'),
        });
      }
    },
  });

  const updateBody =
    bill && edits ? buildDetailUpdatePayload(bill, edits) : null;

  const setEdits = (next: BillEdits): void => {
    if (id) setEdit({ id, edits: next });
  };

  const toggleEdit = (): void => {
    if (!id || !bill) return;
    if (isDraft || edits) setEdit(null);
    else setEdit({ id, edits: billToEdits(bill) });
  };

  const isDuplicateBusy =
    duplicates.mark.isPending ||
    duplicates.unmark.isPending ||
    duplicates.dismiss.isPending ||
    confirmMutation.isPending ||
    saveMutation.isPending ||
    removeMutation.isPending;

  const canConfirm =
    hid !== null &&
    !confirmMutation.isPending &&
    !saveMutation.isPending &&
    !removeMutation.isPending &&
    (edits === null || isEditsValid(edits));

  const canSave =
    hid !== null &&
    !confirmMutation.isPending &&
    !saveMutation.isPending &&
    !removeMutation.isPending &&
    edits !== null &&
    isEditsValid(edits) &&
    updateBody !== null &&
    Object.keys(updateBody).length > 0;

  const canRemove =
    hid !== null &&
    bill !== undefined &&
    !confirmMutation.isPending &&
    !saveMutation.isPending &&
    !removeMutation.isPending;

  return {
    bill,
    edits,
    setEdits,
    isEdited,
    isFailed,
    toggleEdit,
    confirm: () => confirmMutation.mutate(),
    isConfirming: confirmMutation.isPending,
    canConfirm,
    save: () => {
      if (updateBody) saveMutation.mutate(updateBody);
    },
    isSaving: saveMutation.isPending,
    canSave,
    // onError reports the failure; swallow it so the dialog can close.
    remove: () => removeMutation.mutateAsync().catch(() => undefined),
    isRemoving: removeMutation.isPending,
    canRemove,
    close,
    pendingDuplicateOf,
    markPending: (original) => {
      if (id) setPending({ id, original });
    },
    undoPending: () => setPending(null),
    markDuplicate: (original) => {
      if (bill)
        duplicates.mark.mutate({ id: bill.id, duplicateOfId: original.id });
    },
    unmarkDuplicate: () => {
      if (bill) duplicates.unmark.mutate({ id: bill.id });
    },
    keepBoth: (other) => {
      if (bill)
        duplicates.dismiss.mutate({ id: bill.id, otherBillId: other.id });
    },
    isDuplicateBusy,
  };
}
