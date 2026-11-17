import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/ui/use-toast';
import { useHouseholds } from '@/contexts/HouseholdContext';

export type BillLinkState = 'ready' | 'pending' | 'inaccessible';

/** A link's budget, tagged with the history entry the link opened. */
interface BillLink {
  hid: string;
  key: string;
}

const LINK_STATE = 'billLink';

function readPendingLink(state: unknown): BillLink | null {
  if (typeof state !== 'object' || state === null) return null;
  const link = (state as Record<string, unknown>)[LINK_STATE];
  if (typeof link !== 'object' || link === null) return null;
  const { hid, key } = link as Record<string, unknown>;
  return typeof hid === 'string' && typeof key === 'string'
    ? { hid, key }
    : null;
}

/**
 * Applies the budget a bill link carries (`?hid=`): switches to it once per
 * link, then drops `hid` from the address so a later manual switch sticks.
 * Until the switch lands, the link waits in history state. An unknown
 * budget triggers one list refetch per link before it counts as
 * inaccessible.
 */
export function useBillLinkHousehold(): BillLinkState {
  const { t } = useTranslation('households');
  const { status, households, activeHousehold, setActiveHouseholdId, refetch } =
    useHouseholds();
  const location = useLocation();
  const navigate = useNavigate();
  const urlHid = new URLSearchParams(location.search).get('hid');
  const link: BillLink | null =
    urlHid === null
      ? readPendingLink(location.state)
      : { hid: urlHid, key: location.key };
  const linkHid = link?.hid ?? null;
  const linkKey = link?.key ?? null;
  const activeId = activeHousehold?.id ?? null;
  const target = households.find((h) => h.id === linkHid);
  const ready = status === 'ready';

  const [refetchedFor, setRefetchedFor] = useState<string | null>(null);
  // Keyed by the link's history entry, so each new link gets its own try.
  const switched = useRef<string | null>(null);
  const refetched = useRef<string | null>(null);

  useEffect(() => {
    if (linkHid === null || linkKey === null || !ready) return;
    // Drops hid from the address; `pending` keeps the link until it lands.
    const settle = (pending: BillLink | null): void => {
      const params = new URLSearchParams(location.search);
      params.delete('hid');
      const qs = params.toString();
      void navigate(
        { search: qs ? `?${qs}` : '', hash: location.hash },
        {
          replace: true,
          state: pending === null ? null : { [LINK_STATE]: pending },
        }
      );
    };
    if (linkHid === activeId) {
      settle(null);
    } else if (target) {
      if (switched.current === linkKey) return;
      switched.current = linkKey;
      setActiveHouseholdId(linkHid);
      toast({ title: t('switchedTo', { name: target.name }) });
      settle({ hid: linkHid, key: linkKey });
    } else if (refetched.current !== linkKey) {
      refetched.current = linkKey;
      void refetch().finally(() => setRefetchedFor(linkKey));
    }
  }, [
    linkHid,
    linkKey,
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

  if (linkHid === null) return 'ready';
  if (!ready) return 'pending';
  if (linkHid === activeId) return 'ready';
  if (target || refetchedFor !== linkKey) return 'pending';
  return 'inaccessible';
}
