import type { ReactElement } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { useDuplicateMutations } from '@/hooks/useDuplicateMutations';
import {
  EMPTY_DUPLICATE_RANGE,
  useDuplicateSuggestions,
} from '@/hooks/useDuplicateSuggestions';
import type { DuplicateRange, DuplicateSuggestionPair } from '@/types/bills';
import { BillsTabs } from './components/BillsTabs';
import { DuplicatePairCard } from './components/DuplicatePairCard';

const pairKey = (p: DuplicateSuggestionPair): string =>
  `${p.bill.id}|${p.other.id}`;

// Clean-up of double counting a household already has: pairs of confirmed
// bills that look like one purchase.
export function DuplicateSuggestions(): ReactElement {
  const { t } = useTranslation('bills');
  const hid = useActiveHouseholdId();
  const [range, setRange] = useState<DuplicateRange>(EMPTY_DUPLICATE_RANGE);
  const q = useDuplicateSuggestions(range);
  const { mark, dismiss } = useDuplicateMutations(hid);
  // Handled pairs leave the screen at once, before the refetch lands.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const run = (
    pair: DuplicateSuggestionPair,
    start: (opts: { onSuccess: () => void; onSettled: () => void }) => void
  ): void => {
    const key = pairKey(pair);
    if (busyKey !== null) return;
    setBusyKey(key);
    start({
      onSuccess: () => setHidden((prev) => new Set(prev).add(key)),
      onSettled: () => setBusyKey(null),
    });
  };

  const pairs = (q.data?.pairs ?? []).filter((p) => !hidden.has(pairKey(p)));
  const invalidRange =
    !!range.date_from && !!range.date_to && range.date_to < range.date_from;

  return (
    <div className="container mx-auto flex flex-col gap-4 px-4 py-6 sm:py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">
        {t('duplicates.cleanup.title')}
      </h1>
      <BillsTabs />

      <div className="rounded-lg border bg-card p-3 sm:max-w-md sm:p-4">
        <DateRangePicker
          from={range.date_from}
          to={range.date_to}
          onChange={({ from, to }) =>
            setRange({ date_from: from, date_to: to })
          }
        />
      </div>

      {q.isPending && !invalidRange && (
        <p className="text-sm text-muted-foreground">
          {t('confirmed.detail.loading')}
        </p>
      )}

      {q.isError && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-destructive">
            {t('duplicates.cleanup.loadError')}
          </p>
          <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
            {t('confirmed.filters.retry')}
          </Button>
        </div>
      )}

      {q.isSuccess && pairs.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-sm">
          {t('duplicates.cleanup.empty')}
        </div>
      )}

      {pairs.length > 0 && (
        <div className="flex flex-col gap-3">
          {pairs.map((pair) => (
            <DuplicatePairCard
              key={pairKey(pair)}
              pair={pair}
              busy={busyKey === pairKey(pair)}
              onMarkCopy={(copyId, originalId) =>
                run(pair, (opts) =>
                  mark.mutate({ id: copyId, duplicateOfId: originalId }, opts)
                )
              }
              onKeepBoth={() =>
                run(pair, (opts) =>
                  dismiss.mutate(
                    { id: pair.bill.id, otherBillId: pair.other.id },
                    opts
                  )
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
