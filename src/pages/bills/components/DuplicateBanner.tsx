import type { ReactElement } from 'react';
import { useEffect, useId, useRef } from 'react';
import { Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { PossibleDuplicate } from '@/types/bills';
import {
  addedBy,
  describeDuplicate,
  shortBillDate,
} from '../describeDuplicate';

export interface DuplicateBannerProps {
  candidates: PossibleDuplicate[];
  // Draft flows: the original chosen with Mark, saved on confirm.
  pendingOriginal?: PossibleDuplicate | null;
  onMark: (original: PossibleDuplicate) => void;
  onKeepBoth: (other: PossibleDuplicate) => void;
  onUndo?: () => void;
  busy?: boolean;
}

const BOX =
  'flex flex-col gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900';

// Warns that a bill may already be added. Callers decide what Mark and
// Keep both do: a pending link on drafts, an API call on confirmed bills.
export function DuplicateBanner({
  candidates,
  pendingOriginal = null,
  onMark,
  onKeepBoth,
  onUndo,
  busy = false,
}: DuplicateBannerProps): ReactElement | null {
  const { t, i18n } = useTranslation('bills');
  const ids = useId();
  const undoRef = useRef<HTMLButtonElement>(null);
  // Mark unmounts the focused button; keep keyboard focus in the banner.
  const pendingId = pendingOriginal?.id;
  useEffect(() => {
    if (pendingId) undoRef.current?.focus();
  }, [pendingId]);

  if (pendingOriginal) {
    return (
      <div role="status" className={BOX}>
        <div className="flex flex-wrap items-center gap-2">
          <Copy className="h-4 w-4" aria-hidden />
          <span>
            {t('duplicates.pending', {
              name: addedBy(t, pendingOriginal),
              date: shortBillDate(pendingOriginal.bill_date, i18n.language),
            })}
          </span>
          {onUndo && (
            <Button
              ref={undoRef}
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              disabled={busy}
              onClick={onUndo}
            >
              {t('duplicates.undo')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (candidates.length === 0) return null;

  const several = candidates.length > 1;
  return (
    <div role="status" className={BOX}>
      {several && (
        <p className="flex items-center gap-2 font-medium">
          <Copy className="h-4 w-4" aria-hidden />
          {t('duplicates.several')}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {candidates.map((d) => (
          // Each row's buttons are described by its text, so screen readers
          // can tell which bill they act on.
          <li
            key={d.id}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <span id={`${ids}-${d.id}`} className="flex items-center gap-2">
              {!several && <Copy className="h-4 w-4 shrink-0" aria-hidden />}
              {describeDuplicate(t, d, i18n.language)}
            </span>
            <span className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                aria-describedby={`${ids}-${d.id}`}
                disabled={busy}
                onClick={() => onMark(d)}
              >
                {t('duplicates.mark')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-describedby={`${ids}-${d.id}`}
                disabled={busy}
                onClick={() => onKeepBoth(d)}
              >
                {t('duplicates.keepBoth')}
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
