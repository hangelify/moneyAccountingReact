import type { ReactElement } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { BillEditItem, BillEdits } from '@/types/bills';
import { BillReviewFields } from './BillReviewFields';
import { BillTotalsBanner } from './BillTotalsBanner';
import { BillItemsTable } from './BillItemsTable';

const NEW_ITEM: BillEditItem = {
  name: '',
  quantity: 1,
  unit: 'piece',
  weight_kg: null,
  price_per_kg: null,
  final_price: 0,
  sub_category: null,
  category_confidence: 1,
};

export interface BillEditFormProps {
  edits: BillEdits;
  onChange: (edits: BillEdits) => void;
  marketHint?: string;
}

// The editable bill: header fields, the items-vs-total warning and the items.
// Shared by the review page and the bill detail.
export function BillEditForm({
  edits,
  onChange,
  marketHint,
}: BillEditFormProps): ReactElement {
  const setItems = (items: BillEditItem[]): void =>
    onChange({ ...edits, items });

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <BillReviewFields
          edits={edits}
          onChange={(patch) => onChange({ ...edits, ...patch })}
          {...(marketHint ? { marketHint } : {})}
        />
        <BillTotalsBanner
          items={edits.items}
          totalAmount={edits.total_amount}
          currency={edits.currency}
        />
        <BillItemsTable
          items={edits.items}
          onUpdateItem={(index, patch) => {
            // Weight and price per kg only apply to kg; the disabled inputs
            // would otherwise keep sending a weight the user can't clear.
            const leavesKg = patch.unit !== undefined && patch.unit !== 'kg';
            const next = leavesKg
              ? { ...patch, weight_kg: null, price_per_kg: null }
              : patch;
            setItems(
              edits.items.map((item, i) =>
                i === index ? { ...item, ...next } : item
              )
            );
          }}
          onRemoveItem={(index) =>
            setItems(edits.items.filter((_, i) => i !== index))
          }
          onAddItem={() => {
            setItems([...edits.items, { ...NEW_ITEM }]);
            return edits.items.length;
          }}
        />
      </div>
    </TooltipProvider>
  );
}
