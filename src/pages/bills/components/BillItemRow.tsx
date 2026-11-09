import type { ReactElement } from 'react';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DecimalInput } from '@/components/common/DecimalInput';
import { Input } from '@/components/ui/input';
import { CategoryPicker } from '@/components/categories/CategoryPicker';
import { OverflowTooltip } from '@/components/common/OverflowTooltip';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { BillEditItem } from '@/types/bills';
import { formatLineCategory } from '../lineCategory';

const UNITS: BillEditItem['unit'][] = ['', 'kg', 'g', 'l', 'ml', 'piece'];

interface BillItemRowProps {
  item: BillEditItem;
  index: number;
  onChange: (patch: Partial<BillEditItem>) => void;
  onDelete?: () => void;
}

export function BillItemRow({
  item,
  index,
  onChange,
  onDelete,
}: BillItemRowProps): ReactElement {
  const { t } = useTranslation('bills');
  const cols = t('review.items.columns', { returnObjects: true }) as Record<
    string,
    string
  >;
  return (
    <tr className="border-t">
      <td className="px-2 py-2">
        <OverflowTooltip text={item.name}>
          <Input
            data-row-name={index}
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </OverflowTooltip>
      </td>
      <td className="px-2 py-2">
        <DecimalInput
          aria-label={cols.quantity}
          value={item.quantity}
          onValueChange={(quantity) => onChange({ quantity })}
          missingMessage={t('review.missing.quantity')}
        />
      </td>
      <td className="px-2 py-2">
        <select
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
      </td>
      <td className="px-2 py-2">
        <DecimalInput
          aria-label={cols.weightKg}
          disabled={item.unit !== 'kg'}
          value={item.weight_kg}
          onValueChange={(weight_kg) => onChange({ weight_kg })}
        />
      </td>
      <td className="px-2 py-2">
        <DecimalInput
          aria-label={cols.pricePerKg}
          disabled={item.unit !== 'kg'}
          value={item.price_per_kg}
          onValueChange={(price_per_kg) => onChange({ price_per_kg })}
        />
      </td>
      <td className="px-2 py-2">
        <DecimalInput
          aria-label={cols.finalPrice}
          data-testid={`item-final-price-${index}`}
          value={item.final_price}
          onValueChange={(final_price) => onChange({ final_price })}
          missingMessage={t('review.missing.amount')}
        />
      </td>
      <td className="px-2 py-2 text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {item.category_confidence < 0.5 &&
            (item.sub_category || item.category) && (
              <AlertTriangle
                className="h-4 w-4 text-yellow-600"
                aria-label={t('review.items.lowConfidence')}
              />
            )}
          <OverflowTooltip text={formatLineCategory(item) ?? ''}>
            <div className="min-w-0 flex-1">
              <CategoryPicker
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
          </OverflowTooltip>
          {item.category_reasoning && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground"
                  aria-label={t('review.items.categoryReasoningHeading')}
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{item.category_reasoning}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </td>
      {onDelete && (
        <td className="px-2 py-2 w-12">
          <button
            type="button"
            aria-label={t('review.items.deleteAria')}
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      )}
    </tr>
  );
}
