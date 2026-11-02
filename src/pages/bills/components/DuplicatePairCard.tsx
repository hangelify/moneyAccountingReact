import type { ReactElement } from 'react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatAmount } from '@/pages/dashboard/format';
import type { DuplicateSuggestionPair, PossibleDuplicate } from '@/types/bills';
import { addedBy } from '../describeDuplicate';

export interface DuplicatePairCardProps {
  pair: DuplicateSuggestionPair;
  busy: boolean;
  onMarkCopy: (copyId: string, originalId: string) => void;
  onKeepBoth: () => void;
}

// Two confirmed bills that look like one purchase. The pair is ordered by
// id, not age, so the user picks which one is the copy.
export function DuplicatePairCard({
  pair,
  busy,
  onMarkCopy,
  onKeepBoth,
}: DuplicatePairCardProps): ReactElement {
  const { t } = useTranslation('bills');
  const side = (
    copy: PossibleDuplicate,
    original: PossibleDuplicate
  ): ReactElement => (
    <PairSide
      bill={copy}
      busy={busy}
      onMarkCopy={() => onMarkCopy(copy.id, original.id)}
    />
  );
  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {t(`duplicates.cleanup.matchLabel.${pair.match}`)}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onKeepBoth}
        >
          {t('duplicates.keepBoth')}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {side(pair.bill, pair.other)}
        {side(pair.other, pair.bill)}
      </div>
    </article>
  );
}

function PairSide({
  bill,
  busy,
  onMarkCopy,
}: {
  bill: PossibleDuplicate;
  busy: boolean;
  onMarkCopy: () => void;
}): ReactElement {
  const { t, i18n } = useTranslation('bills');
  const detailsId = useId();
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
      <div id={detailsId} className="flex flex-col gap-2">
        <Link
          to={`/bills/confirmed/${bill.id}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {bill.market_name ?? t('cards.noMarket')} ·{' '}
          {bill.bill_date.slice(0, 10)}
        </Link>
        <span className="font-mono">
          {formatAmount(bill.total_amount, bill.currency, i18n.language)}
        </span>
        <span className="text-muted-foreground">
          {t('duplicates.cleanup.addedBy', { name: addedBy(t, bill) })}
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        aria-describedby={detailsId}
        className="self-start"
        disabled={busy}
        onClick={onMarkCopy}
      >
        {t('duplicates.cleanup.isCopy')}
      </Button>
    </div>
  );
}
