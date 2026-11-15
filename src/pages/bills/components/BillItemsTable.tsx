import { useState, type ReactElement } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import type { BillEditItem } from '@/types/bills';
import { BillItemRow } from './BillItemRow';
import { BillItemCard } from './BillItemCard';

interface BillItemsTableProps {
  items: BillEditItem[];
  onUpdateItem: (index: number, patch: Partial<BillEditItem>) => void;
  onRemoveItem: (index: number) => void;
  onAddItem: () => number;
}

export function BillItemsTable({
  items,
  onUpdateItem,
  onRemoveItem,
  onAddItem,
}: BillItemsTableProps): ReactElement {
  const { t } = useTranslation('bills');
  const cols = t('review.items.columns', { returnObjects: true }) as Record<
    string,
    string
  >;
  const [pendingDelete, setPendingDelete] = useState<{
    index: number;
    name: string;
  } | null>(null);

  const requestDelete = (index: number, item: BillEditItem): void => {
    setPendingDelete({
      index,
      name: item.name || t('review.items.deleteUnnamed'),
    });
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t('review.items.heading')}</h2>

      {/* Desktop table */}
      {/* Fixed layout so the weights below hold: Name and Category get the
          most room, and the table scrolls instead of squeezing them. */}
      <Table
        density="compact"
        containerClassName="hidden md:block"
        className="min-w-[1024px] table-fixed"
      >
        <TableHeader>
          <TableRow>
            <TableHead className="w-[24%] font-bold">{cols.name}</TableHead>
            <TableHead className="w-[8%] font-bold">{cols.quantity}</TableHead>
            <TableHead className="w-[9%] font-bold">{cols.unit}</TableHead>
            <TableHead className="w-[10%] font-bold">{cols.weightKg}</TableHead>
            <TableHead className="w-[10%] font-bold">
              {cols.pricePerKg}
            </TableHead>
            <TableHead className="w-[10%] font-bold">
              {cols.finalPrice}
            </TableHead>
            <TableHead className="w-[25%] font-bold">{cols.category}</TableHead>
            <TableHead className="w-12 font-bold" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, i) => (
            <BillItemRow
              key={i}
              item={item}
              index={i}
              onChange={(patch) => onUpdateItem(i, patch)}
              onDelete={() => requestDelete(i, item)}
            />
          ))}
        </TableBody>
      </Table>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {items.map((item, i) => (
          <BillItemCard
            key={i}
            item={item}
            index={i}
            onChange={(patch) => onUpdateItem(i, patch)}
            onDelete={() => requestDelete(i, item)}
          />
        ))}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setPendingDelete(null)}
          title={t('review.items.deleteTitle')}
          description={t('review.items.deleteDescription', {
            name: pendingDelete.name,
          })}
          variant="destructive"
          onConfirm={() => {
            onRemoveItem(pendingDelete.index);
            setPendingDelete(null);
          }}
        />
      )}

      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => {
          const newIndex = onAddItem();
          // The desktop row and the mobile card both render the new input
          // with the same `data-row-name`, but only one is visible per
          // viewport — focusing a `display:none` element is a no-op. Pick
          // the rendered one via offsetParent.
          queueMicrotask(() => {
            const els = document.querySelectorAll<HTMLInputElement>(
              `[data-row-name="${newIndex}"]`
            );
            for (const el of els) {
              if (el.offsetParent !== null) {
                el.focus();
                return;
              }
            }
            // Fallback for environments (e.g. jsdom) that don't compute
            // layout — focus the first one so tests still observe focus.
            els[0]?.focus();
          });
        }}
      >
        <Plus className="mr-2 h-4 w-4" />
        {t('review.items.addRow')}
      </Button>
    </section>
  );
}
