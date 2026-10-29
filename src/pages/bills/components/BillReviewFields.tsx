import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CURRENCY } from '@/const/currency';
import type { BillEdits } from '@/types/bills';

interface BillReviewFieldsProps {
  edits: Pick<
    BillEdits,
    'market_name' | 'bill_date' | 'currency' | 'total_amount'
  >;
  onChange: (patch: Partial<BillEdits>) => void;
  marketHint?: string;
}

export function BillReviewFields({
  edits,
  onChange,
  marketHint,
}: BillReviewFieldsProps): ReactElement {
  const { t } = useTranslation('bills');
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="market_name">{t('review.fields.marketName')}</Label>
        <Input
          id="market_name"
          value={edits.market_name}
          onChange={(e) => onChange({ market_name: e.target.value })}
        />
        {marketHint && (
          <p className="text-xs text-muted-foreground">{marketHint}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bill_date">{t('review.fields.billDate')}</Label>
        <Input
          id="bill_date"
          type="date"
          value={edits.bill_date}
          onChange={(e) => onChange({ bill_date: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="currency">{t('review.fields.currency')}</Label>
        <select
          id="currency"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          value={edits.currency}
          onChange={(e) => onChange({ currency: e.target.value })}
        >
          <option value="">—</option>
          {Object.values(CURRENCY).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="total_amount">{t('review.fields.totalAmount')}</Label>
        <Input
          id="total_amount"
          type="number"
          step="0.01"
          value={edits.total_amount}
          onChange={(e) => onChange({ total_amount: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
