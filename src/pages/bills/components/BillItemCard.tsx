import type { ReactElement } from 'react';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DecimalInput } from '@/components/common/DecimalInput';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CategoryPicker } from '@/components/categories/CategoryPicker';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { BillEditItem } from '@/types/bills';

const UNITS: BillEditItem['unit'][] = ['', 'kg', 'g', 'l', 'ml', 'piece'];

interface BillItemCardProps {
  item: BillEditItem;
  index: number;
  onChange: (patch: Partial<BillEditItem>) => void;
  onDelete?: () => void;
}

export function BillItemCard({
  item,
  index,
  onChange,
  onDelete,
}: BillItemCardProps): ReactElement {
  const { t } = useTranslation('bills');
  const cols = t('review.items.columns', { returnObjects: true }) as Record<
    string,
    string
  >;

  return (
    <div className="relative rounded-md border p-3 space-y-2">
      {onDelete && (
        <button
          type="button"
          aria-label={t('review.items.deleteAria')}
          className="absolute right-2 top-2 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      <div className="space-y-1">
        <Label htmlFor={`item-${index}-name`}>{cols.name}</Label>
        <Input
          id={`item-${index}-name`}
          data-row-name={index}
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`item-${index}-qty`}>{cols.quantity}</Label>
          <DecimalInput
            id={`item-${index}-qty`}
            value={item.quantity}
            onValueChange={(quantity) => onChange({ quantity })}
            missingMessage={t('review.missing.quantity')}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`item-${index}-unit`}>{cols.unit}</Label>
          <select
            id={`item-${index}-unit`}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
            value={item.unit}
            onChange={(e) =>
              onChange({ unit: e.target.value as BillEditItem['unit'] })
            }
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u || '—'}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`item-${index}-price`}>{cols.finalPrice}</Label>
        <DecimalInput
          id={`item-${index}-price`}
          data-testid={`item-final-price-${index}`}
          value={item.final_price}
          onValueChange={(final_price) => onChange({ final_price })}
          missingMessage={t('review.missing.amount')}
        />
      </div>
      {item.unit === 'kg' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor={`item-${index}-weight`}>{cols.weightKg}</Label>
            <DecimalInput
              id={`item-${index}-weight`}
              value={item.weight_kg}
              onValueChange={(weight_kg) => onChange({ weight_kg })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`item-${index}-ppk`}>{cols.pricePerKg}</Label>
            <DecimalInput
              id={`item-${index}-ppk`}
              value={item.price_per_kg}
              onValueChange={(price_per_kg) => onChange({ price_per_kg })}
            />
          </div>
        </div>
      )}
      <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
        {item.category_confidence < 0.5 &&
          (item.sub_category || item.category) && (
            <AlertTriangle
              className="mt-2 h-4 w-4 shrink-0 text-yellow-600"
              aria-label={t('review.items.lowConfidence')}
            />
          )}
        <div className="flex-1">
          <Label htmlFor={`item-${index}-cat`}>{cols.category}</Label>
          <CategoryPicker
            id={`item-${index}-cat`}
            aria-label={cols.category}
            value={{
              category: item.category,
              sub_category: item.sub_category,
            }}
            onChange={(next) =>
              onChange({
                ...next,
                category_confidence: 1,
                category_reasoning: undefined,
              })
            }
          />
        </div>
        {item.category_reasoning && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="mt-7 text-muted-foreground"
                aria-label={t('review.items.categoryReasoningHeading')}
              >
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{item.category_reasoning}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
