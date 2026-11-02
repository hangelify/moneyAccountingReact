import type { ReactElement } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { PossibleDuplicate } from '@/types/bills';
import { addedBy, shortBillDate } from '../describeDuplicate';

export interface DuplicateOfBadgeProps {
  original: PossibleDuplicate;
  onUnmark: () => void;
  busy?: boolean;
}

// Shown on a duplicate: links to its original, which is the counted bill.
export function DuplicateOfBadge({
  original,
  onUnmark,
  busy = false,
}: DuplicateOfBadgeProps): ReactElement {
  const { t, i18n } = useTranslation('bills');
  const location = useLocation();
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 rounded-md border bg-muted p-3 text-sm"
    >
      <Copy className="h-4 w-4" aria-hidden />
      <Link
        to={{ pathname: `../${original.id}`, search: location.search }}
        relative="path"
        className="font-medium underline underline-offset-4"
      >
        {t('duplicates.duplicateOf', {
          name: addedBy(t, original),
          date: shortBillDate(original.bill_date, i18n.language),
        })}
      </Link>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="ml-auto"
        disabled={busy}
        onClick={onUnmark}
      >
        {t('duplicates.unmark')}
      </Button>
    </div>
  );
}
