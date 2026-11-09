import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { billsApi } from '@/pages/bills/api';

export interface BillImage {
  url: string | null;
  blob: Blob | null;
  isError: boolean;
}

// The receipt photo of a bill. The object URL lives as long as the caller.
export function useBillImage(id: string | undefined): BillImage {
  const hid = useActiveHouseholdId();
  const q = useQuery({
    queryKey: ['households', hid, 'bill-image', id],
    queryFn: () => billsApi.draftImage(hid ?? '', id ?? ''),
    enabled: hid !== null && !!id,
    staleTime: Infinity,
    retry: false,
  });
  const data = q.data;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the object URL is an external resource owned by this effect
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(data);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [data]);
  return { url, blob: data ?? null, isError: q.isError };
}
