import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Household } from '@/types/households';
import { MoveBillsDialog } from '../move/MoveBillsDialog';

export interface MoveBillButtonProps {
  onMove: (target: Household) => Promise<void>;
  disabled: boolean;
  // Unsaved edits or a pending duplicate mark: the move would drop them.
  blockedByEdits: boolean;
  className?: string;
}

/** "Move to budget…" on a bill's detail, with the budget picker. */
export function MoveBillButton({
  onMove,
  disabled,
  blockedByEdits,
  className,
}: MoveBillButtonProps): ReactElement {
  const { t } = useTranslation('bills');
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {t('move.action')}
      </Button>
      {blockedByEdits && (
        <p className="text-xs text-muted-foreground">{t('move.saveFirst')}</p>
      )}
      <MoveBillsDialog
        open={open}
        onOpenChange={setOpen}
        count={1}
        onMove={onMove}
      />
    </div>
  );
}
