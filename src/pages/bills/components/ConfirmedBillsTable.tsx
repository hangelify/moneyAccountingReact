import type { KeyboardEvent, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { HouseholdAmount } from '@/components/currency/HouseholdAmount';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { BillResponseDto } from '@/types/bills';

export interface ConfirmedBillsTableProps {
  bills: BillResponseDto[];
  onRowClick: (id: string) => void;
}

function formatAmount(b: BillResponseDto): string {
  return `${b.total_amount.toFixed(2)} ${b.currency ?? ''}`.trim();
}

function onKey(e: KeyboardEvent<HTMLTableRowElement>, cb: () => void): void {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    cb();
  }
}

export function ConfirmedBillsTable({
  bills,
  onRowClick,
}: ConfirmedBillsTableProps): ReactElement {
  const { t } = useTranslation('bills');
  return (
    <Table containerClassName="rounded-lg bg-card" className="text-left">
      <TableHeader>
        <TableRow>
          <TableHead>{t('confirmed.table.date')}</TableHead>
          <TableHead>{t('confirmed.table.total')}</TableHead>
          <TableHead>{t('confirmed.table.market')}</TableHead>
          <TableHead className="hidden md:table-cell">
            {t('confirmed.table.description')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bills.map((b) => (
          <TableRow
            key={b.id}
            data-bill-id={b.id}
            role="button"
            aria-label={
              b.status === 'duplicate'
                ? t('duplicates.openDuplicate')
                : t('confirmed.table.rowAction')
            }
            tabIndex={0}
            className={cn(
              'cursor-pointer outline-none focus-visible:bg-accent hover:bg-accent/40',
              // Shown only with "Show duplicates"; not counted in totals.
              b.status === 'duplicate' && 'opacity-60'
            )}
            onClick={() => onRowClick(b.id)}
            onKeyDown={(e) => onKey(e, () => onRowClick(b.id))}
          >
            <TableCell>
              {b.bill_date.slice(0, 10)}
              {b.status === 'duplicate' && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {t('duplicates.badge')}
                </span>
              )}
            </TableCell>
            <TableCell className="font-mono">
              {formatAmount(b)}
              <HouseholdAmount bill={b} className="block text-xs" />
            </TableCell>
            <TableCell>
              {b.market?.name ?? t('confirmed.table.noMarket')}
            </TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">
              {b.description ?? t('confirmed.table.noMarket')}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
