import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { billsApi } from '@/api/bills';
import { ApiError } from '@/auth/apiError';
import { toast } from '@/components/ui/use-toast';
import {
  OWN_FORBIDDEN_META,
  useActiveHouseholdId,
  useHouseholds,
} from '@/contexts/HouseholdContext';
import type { MoveBillsResponse } from '@/types/bills';
import type { Household } from '@/types/households';
import { readMissingIds, readMoveConflicts } from './moveErrors';
import {
  MoveError,
  type MoveBillRef,
  type MovedBillInfo,
  type MoveFailure,
  type MoveOutcome,
} from './types';

export interface UseMoveBills {
  /** Rejects with a MoveError. */
  move: (bills: MoveBillRef[], target: Household) => Promise<MoveOutcome>;
  isPending: boolean;
}

function toOutcome(
  bills: MoveBillRef[],
  target: Household,
  res: MoveBillsResponse
): MoveOutcome {
  const byId = new Map(bills.map((b) => [b.id, b]));
  const moved: MovedBillInfo[] = res.bills.flatMap((m) => {
    const bill = byId.get(m.id);
    if (!bill) return [];
    return [
      {
        ...bill,
        lostCategory: m.lines_lost_category,
        lostSubCategory: m.lines_lost_sub_category,
        alreadyMoved: m.already_moved,
      },
    ];
  });
  return {
    target,
    moved,
    lostLines: moved.reduce((n, b) => n + b.lostCategory, 0),
    lostSubLines: moved.reduce((n, b) => n + b.lostSubCategory, 0),
    withLosses: moved.filter((b) => b.lostCategory + b.lostSubCategory > 0),
  };
}

/** Moves bills of the active budget to another one, all or nothing. */
export function useMoveBills(): UseMoveBills {
  const { t } = useTranslation('bills');
  const hid = useActiveHouseholdId();
  const { refetch } = useHouseholds();
  const queryClient = useQueryClient();
  const busy = useRef(false);

  const mutation = useMutation({
    mutationFn: (vars: { hid: string; ids: string[]; target: string }) =>
      billsApi.move(vars.hid, {
        bill_ids: vars.ids,
        target_household_id: vars.target,
      }),
    // A 403 may be about the target budget: handled here, not as access lost.
    meta: OWN_FORBIDDEN_META,
  });

  const refreshBoth = (ids: string[], target: string): void => {
    for (const h of [hid, target]) {
      void queryClient.invalidateQueries({
        queryKey: ['households', h, 'bills'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['households', h, 'dashboard'],
      });
    }
    // The server finds or creates the markets in the target budget.
    void queryClient.invalidateQueries({
      queryKey: ['households', target, 'markets'],
    });
    for (const id of ids) {
      queryClient.removeQueries({ queryKey: ['households', hid, 'bill', id] });
      // Open there before (moved there and back): refetch.
      void queryClient.invalidateQueries({
        queryKey: ['households', target, 'bill', id],
      });
    }
  };

  const toFailure = async (
    err: unknown,
    ids: string[],
    target: Household
  ): Promise<MoveFailure> => {
    const conflicts = readMoveConflicts(err);
    if (conflicts) return { kind: 'conflicts', conflicts };
    const missing = readMissingIds(err);
    if (missing) {
      refreshBoth(ids, target.id);
      return { kind: 'missing', ids: missing };
    }
    if (err instanceof ApiError && err.status === 403) {
      await refetch();
      toast({
        variant: 'destructive',
        title: t('move.forbidden', { name: target.name }),
      });
      return { kind: 'forbidden' };
    }
    return { kind: 'other' };
  };

  const move = async (
    bills: MoveBillRef[],
    target: Household
  ): Promise<MoveOutcome> => {
    if (busy.current || hid === null) {
      throw new MoveError({ kind: 'other' });
    }
    busy.current = true;
    const ids = bills.map((b) => b.id);
    try {
      const res = await mutation.mutateAsync({
        hid,
        ids,
        target: target.id,
      });
      refreshBoth(ids, target.id);
      return toOutcome(bills, target, res);
    } catch (err) {
      throw new MoveError(await toFailure(err, ids, target));
    } finally {
      busy.current = false;
    }
  };

  return { move, isPending: mutation.isPending };
}
