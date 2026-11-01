import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { BillDetailResponseDto } from '@/types/bills';
import type { BillDetailActions } from '../useBillDetailActions';
import { DuplicateBanner } from './DuplicateBanner';
import { DuplicateOfBadge } from './DuplicateOfBadge';

export interface BillDuplicateSectionProps {
  bill: BillDetailResponseDto;
  actions: Pick<
    BillDetailActions,
    | 'pendingDuplicateOf'
    | 'markPending'
    | 'undoPending'
    | 'markDuplicate'
    | 'unmarkDuplicate'
    | 'keepBoth'
    | 'isDuplicateBusy'
  >;
}

// Duplicate state of a bill, above its details on both the page and the
// drawer: a badge on a duplicate, look-alike warnings otherwise, and the
// receipt ids the match is based on.
export function BillDuplicateSection({
  bill,
  actions,
}: BillDuplicateSectionProps): ReactElement | null {
  const isDraft = bill.status === 'draft';
  const receipt = <BillReceiptIds bill={bill} />;

  if (bill.status === 'duplicate' && bill.duplicate_of) {
    return (
      <div className="flex flex-col gap-3">
        <DuplicateOfBadge
          original={bill.duplicate_of}
          onUnmark={actions.unmarkDuplicate}
          busy={actions.isDuplicateBusy}
        />
        {receipt}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 empty:hidden">
      <DuplicateBanner
        candidates={bill.possible_duplicates ?? []}
        // A draft links on Confirm; a confirmed bill is marked right away.
        pendingOriginal={isDraft ? actions.pendingDuplicateOf : null}
        onMark={isDraft ? actions.markPending : actions.markDuplicate}
        onKeepBoth={actions.keepBoth}
        onUndo={actions.undoPending}
        busy={actions.isDuplicateBusy}
      />
      {receipt}
    </div>
  );
}

function BillReceiptIds({
  bill,
}: {
  bill: BillDetailResponseDto;
}): ReactElement | null {
  const { t } = useTranslation('bills');
  const fields = [
    ['registerId', bill.fiscal_register_id],
    ['number', bill.fiscal_receipt_number],
    ['time', bill.purchase_time],
  ] as const;
  const shown = fields.filter(([, value]) => value);
  if (shown.length === 0) return null;
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      {shown.map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <dt className="text-muted-foreground">
            {t(`duplicates.receipt.${key}`)}
          </dt>
          <dd className="font-mono">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
