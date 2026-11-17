import { useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/auth/apiError';
import { householdErrorReason } from '@/auth/householdErrorReason';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useHouseholds } from '@/contexts/HouseholdContext';
import { useDeleteHousehold } from '@/hooks/useHouseholdMutations';
import type { Household } from '@/types/households';

function failureKey(error: unknown): `delete.${string}` {
  const reason = householdErrorReason(error);
  if (reason === 'last_household') return 'delete.onlyOne';
  if (reason === 'household_has_members') return 'delete.hasMembers';
  if (error instanceof ApiError && error.status === 403) {
    return 'delete.forbidden';
  }
  return 'delete.failed';
}

export function DeleteHouseholdButton({
  household,
  onDeleted,
}: {
  household: Household;
  /** Called once the dialog has gone, to move focus off the removed card. */
  onDeleted?: (() => void) | undefined;
}): ReactElement {
  const { t } = useTranslation('households');
  const { households } = useHouseholds();
  const mutation = useDeleteHousehold();
  const [open, setOpen] = useState(false);
  const deleted = useRef(false);

  let blocked: string | null = null;
  if (households.length === 1) blocked = t('delete.onlyOne');
  else if (household.member_count > 1) blocked = t('delete.hasMembers');

  const onConfirm = async (): Promise<void> => {
    try {
      await mutation.mutateAsync(household.id);
      deleted.current = true;
      toast({ variant: 'success', title: t('delete.done') });
    } catch (error) {
      toast({ variant: 'destructive', title: t(failureKey(error)) });
    }
    setOpen(false);
  };

  const button = (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={blocked !== null}
      onClick={() => setOpen(true)}
    >
      {t('delete.button')}
    </Button>
  );

  return (
    <>
      {blocked ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-block">
                {button}
              </span>
            </TooltipTrigger>
            <TooltipContent>{blocked}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        button
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        variant="destructive"
        title={t('delete.title', { name: household.name })}
        description={
          household.bill_count > 0
            ? t('delete.withBills', { count: household.bill_count })
            : t('delete.noBills')
        }
        confirmLabel={t('delete.confirm')}
        onConfirm={onConfirm}
        onCloseAutoFocus={(event) => {
          if (!deleted.current) return;
          // The trigger is gone with the card: focus would fall to <body>.
          event.preventDefault();
          onDeleted?.();
        }}
      />
    </>
  );
}
