import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import type { BillDetailResponseDto } from '@/types/bills';

interface DeleteBillButtonProps {
  bill: BillDetailResponseDto;
  onDelete: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

// Wording follows the bill kind: a draft is discarded, a duplicate is a copy.
function kindOf(bill: BillDetailResponseDto): 'bill' | 'draft' | 'copy' {
  if (bill.status === 'draft') return 'draft';
  if (bill.status === 'duplicate') return 'copy';
  return 'bill';
}

// The delete is final (no restore), so it always asks first.
export function DeleteBillButton({
  bill,
  onDelete,
  disabled,
  className,
}: DeleteBillButtonProps): ReactElement {
  const { t } = useTranslation('bills');
  const [open, setOpen] = useState(false);
  const kind = kindOf(bill);
  const label = t(`confirmed.detail.delete.${kind}.action`);

  return (
    <>
      <Button
        variant="destructive"
        className={className}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        variant="destructive"
        title={t(`confirmed.detail.delete.${kind}.title`)}
        description={t(`confirmed.detail.delete.${kind}.description`)}
        confirmLabel={label}
        onConfirm={async () => {
          await onDelete();
          setOpen(false);
        }}
      />
    </>
  );
}
