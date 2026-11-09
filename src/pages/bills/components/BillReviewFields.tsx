import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { DecimalInput } from '@/components/common/DecimalInput';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CURRENCY } from '@/const/currency';
import type { BillEdits } from '@/types/bills';

interface BillReviewFieldsProps {
  edits: Pick<
    BillEdits,
    | 'market_name'
    | 'bill_date'
    | 'currency'
    | 'total_amount'
    | 'fiscal_register_id'
    | 'fiscal_receipt_number'
    | 'purchase_time'
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
        <DecimalInput
          id="total_amount"
          value={edits.total_amount}
          onValueChange={(total_amount) => onChange({ total_amount })}
          missingMessage={t('review.missing.amount')}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fiscal_register_id">
          {t('duplicates.receipt.registerId')}
        </Label>
        <Input
          id="fiscal_register_id"
          maxLength={64}
          value={edits.fiscal_register_id}
          onChange={(e) => onChange({ fiscal_register_id: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fiscal_receipt_number">
          {t('duplicates.receipt.number')}
        </Label>
        <Input
          id="fiscal_receipt_number"
          maxLength={64}
          value={edits.fiscal_receipt_number}
          onChange={(e) => onChange({ fiscal_receipt_number: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="purchase_time">{t('duplicates.receipt.time')}</Label>
        <Input
          id="purchase_time"
          type="time"
          value={edits.purchase_time}
          onChange={(e) => onChange({ purchase_time: e.target.value })}
        />
      </div>
    </div>
  );
}
