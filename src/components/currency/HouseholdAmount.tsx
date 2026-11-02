/* eslint-disable react-refresh/only-export-components */
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatAmount } from '@/pages/dashboard/format';
import type { BillResponseDto } from '@/types/bills';

export type HouseholdAmountBill = Pick<
  BillResponseDto,
  'currency' | 'household_currency' | 'household_amount'
>;

/** "≈ 1,009.95 MDL", or null when there is nothing to add to the original. */
export function householdAmountText(
  bill: HouseholdAmountBill,
  lang: string
): string | null {
  const { currency, household_currency: to, household_amount: amount } = bill;
  if (!currency || !to || currency === to || amount == null) return null;
  return `≈ ${formatAmount(amount, null, lang)} ${to}`;
}

/** The bill's total in the household currency, when it differs. */
export function HouseholdAmount({
  bill,
  className,
}: {
  bill: HouseholdAmountBill;
  className?: string;
}): ReactElement | null {
  const { i18n } = useTranslation();
  const text = householdAmountText(bill, i18n.language);
  if (text === null) return null;
  return <span className={cn('text-muted-foreground', className)}>{text}</span>;
}
