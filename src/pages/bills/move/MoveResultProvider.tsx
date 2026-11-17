/* eslint-disable react-refresh/only-export-components -- context and hook live next to the provider */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { MoveResultDialog, type MoveResultView } from './MoveResultDialog';
import {
  movedBillHref,
  type MoveBillRef,
  type MoveFailure,
  type MoveOutcome,
} from './types';

export interface MoveFailureContext {
  bills: MoveBillRef[];
  onUnselect?: (ids: string[]) => void;
  // Runs before "Show duplicates" leaves for the list (e.g. closes a detail).
  beforeShowDuplicates?: () => void;
}

export interface MoveResultApi {
  reportSuccess: (outcome: MoveOutcome) => void;
  reportFailure: (failure: MoveFailure, ctx: MoveFailureContext) => void;
}

const MoveResultContext = createContext<MoveResultApi | null>(null);

/**
 * Reports moves with toasts and the result dialog. Sits above a bill list
 * and its detail route, so the dialog outlives a detail that closes.
 */
export function MoveResultProvider({
  showDuplicatesHref,
  children,
}: {
  showDuplicatesHref: string;
  children: ReactNode;
}): ReactElement {
  const { t } = useTranslation('bills');
  const navigate = useNavigate();
  const [view, setView] = useState<MoveResultView | null>(null);

  const reportSuccess = useCallback(
    (outcome: MoveOutcome) => {
      const [only] = outcome.moved;
      toast({
        variant: 'success',
        title: t('move.done', {
          count: outcome.moved.length,
          name: outcome.target.name,
        }),
        ...(outcome.lostLines > 0 && {
          description: t('move.lostCategory', { count: outcome.lostLines }),
        }),
        ...(outcome.moved.length === 1 &&
          only && {
            action: (
              <ToastAction
                altText={t('move.result.open')}
                onClick={() =>
                  void navigate(movedBillHref(only, outcome.target.id))
                }
              >
                {t('move.result.open')}
              </ToastAction>
            ),
          }),
      });
      if (outcome.withLosses.length > 0) setView({ mode: 'losses', outcome });
    },
    [navigate, t]
  );

  const reportFailure = useCallback(
    (failure: MoveFailure, ctx: MoveFailureContext) => {
      switch (failure.kind) {
        case 'conflicts':
          setView({ mode: 'conflicts', conflicts: failure.conflicts, ...ctx });
          return;
        case 'missing':
          toast({ title: t('move.missing') });
          return;
        case 'forbidden':
          // useMoveBills has told the user already.
          return;
        case 'other':
          toast({ variant: 'destructive', title: t('move.failed') });
      }
    },
    [t]
  );

  const api = useMemo(
    () => ({ reportSuccess, reportFailure }),
    [reportSuccess, reportFailure]
  );

  const showDuplicates = (): void => {
    if (view?.mode === 'conflicts') view.beforeShowDuplicates?.();
    setView(null);
    void navigate(showDuplicatesHref);
  };

  return (
    <MoveResultContext.Provider value={api}>
      {children}
      <MoveResultDialog
        view={view}
        onClose={() => setView(null)}
        onShowDuplicates={showDuplicates}
      />
    </MoveResultContext.Provider>
  );
}

export function useMoveResult(): MoveResultApi {
  const ctx = useContext(MoveResultContext);
  if (!ctx) {
    throw new Error('useMoveResult must be used within a MoveResultProvider');
  }
  return ctx;
}
