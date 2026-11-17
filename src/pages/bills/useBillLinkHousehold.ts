import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/ui/use-toast';
import { useHouseholds } from '@/contexts/HouseholdContext';

export type BillLinkState = 'ready' | 'pending' | 'inaccessible';

/**
 * Applies the budget a bill link carries (`?hid=`): switches to it once,
 * then drops `hid` from the address so a later manual switch sticks. An
 * unknown budget triggers one list refetch before it counts as inaccessible.
 */
export function useBillLinkHousehold(): BillLinkState {
  const { t } = useTranslation('households');
  const { status, households, activeHousehold, setActiveHouseholdId, refetch } =
    useHouseholds();
  const location = useLocation();
  const navigate = useNavigate();
  const hid = new URLSearchParams(location.search).get('hid');
  const activeId = activeHousehold?.id ?? null;
  const target = households.find((h) => h.id === hid);
  const ready = status === 'ready';

  // The budget switched to, until it becomes the active one.
  const [awaiting, setAwaiting] = useState<string | null>(null);
  if (ready && hid !== null && target && hid !== activeId && awaiting !== hid) {
    setAwaiting(hid);
  }
  if (awaiting !== null && awaiting === activeId) setAwaiting(null);

  const [refetchedFor, setRefetchedFor] = useState<string | null>(null);
  const switched = useRef<string | null>(null);
  const refetched = useRef<string | null>(null);

  useEffect(() => {
    if (hid === null || !ready) return;
    const dropHid = (): void => {
      const params = new URLSearchParams(location.search);
      params.delete('hid');
      const qs = params.toString();
      void navigate(
        { search: qs ? `?${qs}` : '', hash: location.hash },
        { replace: true }
      );
    };
    if (hid === activeId) {
      dropHid();
    } else if (target) {
      if (switched.current === hid) return;
      switched.current = hid;
      setActiveHouseholdId(hid);
      toast({ title: t('switchedTo', { name: target.name }) });
      dropHid();
    } else if (refetched.current !== hid) {
      refetched.current = hid;
      void refetch().finally(() => setRefetchedFor(hid));
    }
  }, [
    hid,
    ready,
    activeId,
    target,
    location.search,
    location.hash,
    navigate,
    setActiveHouseholdId,
    refetch,
    t,
  ]);

  if (awaiting !== null) return 'pending';
  if (hid === null) return 'ready';
  if (!ready) return 'pending';
  if (hid === activeId) return 'ready';
  if (target || refetchedFor !== hid) return 'pending';
  return 'inaccessible';
}
