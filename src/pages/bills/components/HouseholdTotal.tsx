import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { HouseholdAmount } from '@/components/currency/HouseholdAmount';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { localIsoDate } from '@/pages/dashboard/period';
import type { BillDetailResponseDto } from '@/types/bills';

/** The total in the household currency, or why it is missing. */
export function HouseholdTotal({
  bill,
}: {
  bill: BillDetailResponseDto;
}): ReactElement | null {
  const { t, i18n } = useTranslation('bills');
  const rate = bill.exchange_rate;
  if (!bill.household_currency) return null;
  if (bill.household_amount == null) {
    let note: string;
    if (!bill.currency) note = t('confirmed.detail.notConverted.noCurrency');
    else if (bill.bill_date.slice(0, 10) > localIsoDate())
      note = t('confirmed.detail.notConverted.futureDate');
    else note = t('confirmed.detail.notConverted.pending');
    return (
      <span className="block font-sans text-xs text-muted-foreground">
        {note}
      </span>
    );
  }
  const amount = <HouseholdAmount bill={bill} className="block text-xs" />;
  if (!rate || !bill.currency) return amount;
  const date = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${rate.rate_date}T00:00:00Z`));
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="w-fit">
            {amount}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {t('confirmed.detail.rate', {
            from: bill.currency,
            to: bill.household_currency,
            rate: rate.rate,
            date,
          })}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
