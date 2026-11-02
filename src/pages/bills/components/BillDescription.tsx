import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { BillDetailResponseDto } from '@/types/bills';

// The bill's description, which the form does not edit; nothing when empty.
export function BillDescription({
  bill,
}: {
  bill: Pick<BillDetailResponseDto, 'description'>;
}): ReactElement | null {
  const { t } = useTranslation('bills');
  if (!bill.description) return null;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">
        {t('confirmed.table.description')}
      </span>
      <span>{bill.description}</span>
    </div>
  );
}
