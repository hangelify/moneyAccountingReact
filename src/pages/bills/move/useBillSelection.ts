import { useState } from 'react';
import type { BillResponseDto } from '@/types/bills';

/** What a list view needs to draw and change the selection. */
export interface BillSelectionView {
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  isSelectable: (bill: BillResponseDto) => boolean;
}

export interface BillSelection {
  selecting: boolean;
  selected: ReadonlySet<string>;
  start: () => void;
  cancel: () => void;
  toggle: (id: string) => void;
  setMany: (ids: string[], on: boolean) => void;
  unselect: (ids: string[]) => void;
}

interface State {
  key: string;
  selecting: boolean;
  selected: ReadonlySet<string>;
}

const EMPTY: ReadonlySet<string> = new Set();

/** A duplicate can't be moved, so it can't be picked either. */
export function isMovableBill(bill: BillResponseDto): boolean {
  return bill.status !== 'duplicate';
}

/**
 * Bills picked on one page of a list. A new resetKey (page, filters or
 * budget changed) drops the selection and leaves selection mode.
 */
export function useBillSelection(resetKey: string): BillSelection {
  const [state, setState] = useState<State>({
    key: resetKey,
    selecting: false,
    selected: EMPTY,
  });
  // Adjusting state while rendering: the stale selection is never shown.
  if (state.key !== resetKey) {
    setState({ key: resetKey, selecting: false, selected: EMPTY });
  }
  const current =
    state.key === resetKey
      ? state
      : { key: resetKey, selecting: false, selected: EMPTY };

  const update = (fn: (selected: Set<string>) => void): void => {
    setState((s) => {
      const next = new Set(s.selected);
      fn(next);
      return { ...s, selected: next };
    });
  };

  return {
    selecting: current.selecting,
    selected: current.selected,
    start: () => setState({ key: resetKey, selecting: true, selected: EMPTY }),
    cancel: () =>
      setState({ key: resetKey, selecting: false, selected: EMPTY }),
    toggle: (id) =>
      update((s) => {
        if (!s.delete(id)) s.add(id);
      }),
    setMany: (ids, on) =>
      update((s) => {
        for (const id of ids) {
          if (on) s.add(id);
          else s.delete(id);
        }
      }),
    unselect: (ids) =>
      update((s) => {
        for (const id of ids) s.delete(id);
      }),
  };
}
