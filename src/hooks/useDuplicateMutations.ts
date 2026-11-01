import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { billsApi } from '@/pages/bills/api';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@/auth/apiError';
import { isHouseholdForbidden } from '@/auth/isHouseholdForbidden';
import type { BillDetailResponseDto } from '@/types/bills';

export interface DuplicateMutations {
  mark: UseMutationResult<
    BillDetailResponseDto,
    unknown,
    { id: string; duplicateOfId: string }
  >;
  unmark: UseMutationResult<BillDetailResponseDto, unknown, { id: string }>;
  // silent: best-effort calls (Keep both on a draft) show no error toast.
  dismiss: UseMutationResult<
    void,
    unknown,
    { id: string; otherBillId: string; silent?: boolean }
  >;
}

// Mark, unmark and "Keep both". Totals and copies can move to another bill,
// so every success refreshes all bills, lists and the dashboard.
export function useDuplicateMutations(hid: string | null): DuplicateMutations {
  const { t } = useTranslation(['bills', 'errors']);
  const queryClient = useQueryClient();

  const refreshAll = (): void => {
    // Markets carry bill_count, which only counts confirmed bills.
    for (const part of ['bills', 'bill', 'dashboard', 'markets']) {
      void queryClient.invalidateQueries({
        queryKey: ['households', hid, part],
      });
    }
  };

  const onError = (err: unknown, id: string): void => {
    // The household provider handles 403 for every mutation.
    if (isHouseholdForbidden(err)) return;
    const status = err instanceof ApiError ? err.status : undefined;
    if (status === 409) {
      void queryClient.invalidateQueries({
        queryKey: ['households', hid, 'bill', id],
      });
      toast({ title: t('bills:duplicates.errors.conflict') });
    } else if (status === 404) {
      // The bill or the other one is gone: refresh what still shows it.
      void queryClient.invalidateQueries({
        queryKey: ['households', hid, 'bill', id],
      });
      void queryClient.invalidateQueries({
        queryKey: ['households', hid, 'bills'],
      });
      toast({
        variant: 'destructive',
        title: t('bills:duplicates.errors.notFound'),
      });
    } else if (status === 400 && err instanceof ApiError) {
      toast({
        variant: 'destructive',
        title: t('bills:duplicates.errors.invalid'),
        description: err.messages.join('\n'),
      });
    } else {
      toast({ variant: 'destructive', title: t('errors:saveFailed') });
    }
  };

  const onDetail = (id: string, detail: BillDetailResponseDto): void => {
    queryClient.setQueryData(['households', hid, 'bill', id], detail);
    refreshAll();
  };

  const mark = useMutation({
    mutationFn: ({
      id,
      duplicateOfId,
    }: {
      id: string;
      duplicateOfId: string;
    }) => billsApi.markDuplicate(hid!, id, duplicateOfId),
    onSuccess: (detail, { id }) => onDetail(id, detail),
    onError: (err, { id }) => onError(err, id),
  });

  const unmark = useMutation({
    mutationFn: ({ id }: { id: string }) => billsApi.unmarkDuplicate(hid!, id),
    onSuccess: (detail, { id }) => onDetail(id, detail),
    onError: (err, { id }) => onError(err, id),
  });

  const dismiss = useMutation({
    mutationFn: ({
      id,
      otherBillId,
    }: {
      id: string;
      otherBillId: string;
      silent?: boolean;
    }) => billsApi.dismissDuplicate(hid!, id, otherBillId),
    onSuccess: refreshAll,
    onError: (err, { id, silent }) => {
      if (!silent) onError(err, id);
    },
  });

  return { mark, unmark, dismiss };
}
