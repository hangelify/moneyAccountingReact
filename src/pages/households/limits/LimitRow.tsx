import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CategoryLimit } from '@/types/categoryLimits';
import { formatLongDate } from './formatDate';
import { LimitForm } from './LimitForm';
import type { LimitRowModel } from './limitRows';
import { RemoveLimitDialog } from './RemoveLimitDialog';

interface LimitRowProps {
  hid: string;
  row: LimitRowModel;
  /** The budget's currency. */
  currency: string;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
}

/** One category: its limit, the actions on it, or the inline form. */
export function LimitRow({
  hid,
  row,
  currency,
  editing,
  onEdit,
  onDone,
}: LimitRowProps): ReactElement {
  const { t } = useTranslation('limits');
  const archived = row.state === 'archived';
  const actionsRef = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(editing);

  // The form is gone: put focus back on the row's first action.
  useEffect(() => {
    // Only when focus has nowhere else to be: another row may have taken it.
    const active = document.activeElement;
    const orphaned = active === null || active === document.body;
    if (wasEditing.current && !editing && orphaned) {
      actionsRef.current?.querySelector('button')?.focus();
    }
    wasEditing.current = editing;
  }, [editing]);

  return (
    <li
      className={cn(
        'space-y-1 border-b py-3 last:border-b-0',
        archived && 'text-muted-foreground'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          {row.name}
          {archived && (
            <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">
              {t('row.archived')}
            </span>
          )}
        </span>
        {!editing && <LimitSummary row={row} currency={currency} />}
      </div>
      {editing ? (
        <LimitForm
          hid={hid}
          categoryId={row.categoryId}
          categoryName={row.name}
          current={row.limit}
          currency={currency}
          onDone={onDone}
        />
      ) : (
        <div ref={actionsRef}>
          <RowActions hid={hid} row={row} onEdit={onEdit} />
        </div>
      )}
    </li>
  );
}

function LimitSummary({
  row,
  currency,
}: {
  row: LimitRowModel;
  currency: string;
}): ReactElement {
  const { t, i18n } = useTranslation('limits');
  if (row.limit === null) {
    return (
      <span className="text-sm text-muted-foreground">{t('row.noLimit')}</span>
    );
  }
  return (
    <span className="text-right text-sm">
      <span className="block">{limitText(row.limit, t, i18n.language)}</span>
      {row.otherCurrency && row.state !== 'archived' && (
        <span className="block text-xs text-muted-foreground">
          {t('row.otherCurrency', { currency })}
        </span>
      )}
    </span>
  );
}

function limitText(
  limit: CategoryLimit,
  t: TFunction<'limits'>,
  lang: string
): string {
  const per = t(`per.${limit.period_type}`);
  const amount = `${formatAmount(limit.amount, limit.currency, lang)} ${per}`;
  if (limit.effective_to === null) return amount;
  const until = t('row.until', {
    date: formatLongDate(limit.effective_to, lang),
  });
  return `${amount} · ${until}`;
}

function RowActions({
  hid,
  row,
  onEdit,
}: {
  hid: string;
  row: LimitRowModel;
  onEdit: () => void;
}): ReactElement | null {
  const { t } = useTranslation('limits');
  const [removing, setRemoving] = useState(false);

  if (row.state === 'archived') return null;
  if (row.state !== 'active' || row.limit === null) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={t('row.setLabel', { name: row.name })}
        onClick={onEdit}
      >
        {t('row.set')}
      </Button>
    );
  }
  return (
    <div className="flex gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('row.editLabel', { name: row.name })}
        onClick={onEdit}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('row.removeLabel', { name: row.name })}
        onClick={() => {
          setRemoving(true);
        }}
      >
        <X className="h-4 w-4" />
      </Button>
      <RemoveLimitDialog
        hid={hid}
        name={row.name}
        limit={row.limit}
        open={removing}
        onOpenChange={setRemoving}
      />
    </div>
  );
}
