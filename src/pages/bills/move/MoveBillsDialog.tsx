import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useHouseholds } from '@/contexts/HouseholdContext';
import type { Household } from '@/types/households';

export interface MoveBillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // How many bills move.
  count: number;
  // Closes the dialog once it settles, success or not.
  onMove: (target: Household) => Promise<void>;
}

/** Picks the budget to move bills to: every budget but the active one. */
export function MoveBillsDialog(props: MoveBillsDialogProps): ReactElement {
  // Remounted on every open, so the pick starts empty.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && <MoveBillsDialogBody {...props} />}
    </Dialog>
  );
}

function MoveBillsDialogBody({
  onOpenChange,
  count,
  onMove,
}: MoveBillsDialogProps): ReactElement {
  const { t } = useTranslation(['bills', 'common']);
  const { households, activeHousehold } = useHouseholds();
  const targets = households.filter((h) => h.id !== activeHousehold?.id);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const picked = targets.find((h) => h.id === pickedId) ?? null;

  const submit = async (): Promise<void> => {
    if (!picked || pending) return;
    setPending(true);
    try {
      await onMove(picked);
    } catch {
      // The caller reports the failure.
    } finally {
      setPending(false);
      onOpenChange(false);
    }
  };

  return (
    <DialogContent
      // Blocks closing while the move is in flight.
      onEscapeKeyDown={(e) => pending && e.preventDefault()}
      onInteractOutside={(e) => pending && e.preventDefault()}
      hideCloseButton={pending}
    >
      <DialogHeader>
        <DialogTitle>{t('move.dialog.title', { count })}</DialogTitle>
        <DialogDescription>{t('move.dialog.hint')}</DialogDescription>
      </DialogHeader>
      <fieldset className="flex flex-col gap-2" disabled={pending}>
        <legend className="sr-only">{t('move.dialog.legend')}</legend>
        {targets.map((h) => (
          <label
            key={h.id}
            className="flex cursor-pointer items-center gap-3 rounded-md border p-3 has-[:checked]:border-primary"
          >
            <input
              type="radio"
              name="move-target"
              value={h.id}
              checked={pickedId === h.id}
              onChange={() => setPickedId(h.id)}
            />
            <span className="min-w-0 flex-1 truncate">{h.name}</span>
            <span className="text-sm text-muted-foreground">{h.currency}</span>
          </label>
        ))}
      </fieldset>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={pending}
        >
          {t('common:actions.cancel')}
        </Button>
        <Button
          onClick={() => void submit()}
          disabled={picked === null || pending}
        >
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('move.dialog.submit')}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
