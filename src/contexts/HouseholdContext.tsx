/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import i18n from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { isHouseholdForbidden } from '@/auth/isHouseholdForbidden';
import { householdsApi } from '@/pages/households/api';
import {
  pickActiveHousehold,
  readRememberedHouseholdId,
  writeRememberedHouseholdId,
} from '@/pages/households/pickActiveHousehold';
import type { Household } from '@/types/households';

export interface HouseholdContextValue {
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  households: Household[];
  activeHousehold: Household | null;
  setActiveHouseholdId: (id: string) => void;
  /** Pass the 403 error when known so the central cache hook skips it. */
  handleForbidden: (err?: unknown) => Promise<void>;
  refetch: () => Promise<void>;
}

export const HouseholdContext = createContext<HouseholdContextValue | null>(
  null
);

const HOUSEHOLDS_KEY = ['households'] as const;
const NO_HOUSEHOLDS: Household[] = [];

export function HouseholdProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [rememberedId, setRememberedId] = useState<string | null>(
    readRememberedHouseholdId
  );

  const query = useQuery({
    queryKey: HOUSEHOLDS_KEY,
    queryFn: householdsApi.list,
    enabled: isAuthenticated,
  });

  const households = isAuthenticated
    ? (query.data ?? NO_HOUSEHOLDS)
    : NO_HOUSEHOLDS;
  const activeHousehold = useMemo(
    () => pickActiveHousehold(households, rememberedId),
    [households, rememberedId]
  );
  const activeId = activeHousehold?.id ?? null;

  let status: HouseholdContextValue['status'];
  if (!isAuthenticated) status = 'idle';
  else if (query.isError) status = 'error';
  else if (query.data === undefined) status = 'loading';
  else status = households.length === 0 ? 'empty' : 'ready';

  // Write the resolved (re-validated) id back so a stale one is replaced.
  useEffect(() => {
    if (activeId !== null) writeRememberedHouseholdId(activeId);
  }, [activeId]);

  // Sign-out: forget the household. Only on a true -> false transition, since
  // `isAuthenticated` is also false while the session is still being restored.
  const wasAuthenticated = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      writeRememberedHouseholdId(null);
      setRememberedId(null);
      queryClient.removeQueries({ queryKey: HOUSEHOLDS_KEY });
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated, queryClient]);

  const refetchList = query.refetch;
  const refetch = useCallback(async () => {
    await refetchList();
  }, [refetchList]);

  const setActiveHouseholdId = useCallback(
    (id: string) => {
      if (!households.some((h) => h.id === id)) return;
      setRememberedId(id);
      writeRememberedHouseholdId(id);
    },
    [households]
  );

  // Parallel 403s share one refetch and one toast.
  const inFlight = useRef<Promise<void> | null>(null);
  const handled = useRef(new WeakSet<object>());
  const handleForbidden = useCallback(
    (err?: unknown): Promise<void> => {
      if (typeof err === 'object' && err !== null) handled.current.add(err);
      inFlight.current ??= (async () => {
        try {
          await refetchList();
          toast({
            variant: 'destructive',
            title: i18n.t('households:accessLost'),
          });
        } finally {
          inFlight.current = null;
        }
      })();
      return inFlight.current;
    },
    [refetchList]
  );

  // Central 403 hook for every household query and mutation. The list query
  // itself is skipped: GET /households is not a household-scoped path.
  const handleForbiddenRef = useRef(handleForbidden);
  handleForbiddenRef.current = handleForbidden;
  useEffect(() => {
    const check = (error: unknown): void => {
      if (!isHouseholdForbidden(error)) return;
      if (handled.current.has(error as object)) return;
      void handleForbiddenRef.current(error);
    };
    const unsubQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return;
      const key = event.query.queryKey as readonly unknown[];
      if (key[0] === 'households' && key.length > 1) {
        check(event.action.error);
      }
    });
    const unsubMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') {
        check(event.action.error);
      }
    });
    return () => {
      unsubQueries();
      unsubMutations();
    };
  }, [queryClient]);

  const value = useMemo<HouseholdContextValue>(
    () => ({
      status,
      households,
      activeHousehold,
      setActiveHouseholdId,
      handleForbidden,
      refetch,
    }),
    [
      status,
      households,
      activeHousehold,
      setActiveHouseholdId,
      handleForbidden,
      refetch,
    ]
  );

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHouseholds(): HouseholdContextValue {
  const ctx = useContext(HouseholdContext);
  if (!ctx) {
    throw new Error('useHouseholds must be used within a HouseholdProvider');
  }
  return ctx;
}

export function useActiveHouseholdId(): string | null {
  const { status, activeHousehold } = useHouseholds();
  return status === 'ready' ? (activeHousehold?.id ?? null) : null;
}
