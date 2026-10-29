import type { KeyboardEvent, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
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
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-3 py-2 font-medium">
              {t('confirmed.table.date')}
            </th>
            <th className="px-3 py-2 font-medium">
              {t('confirmed.table.total')}
            </th>
            <th className="px-3 py-2 font-medium">
              {t('confirmed.table.market')}
            </th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">
              {t('confirmed.table.description')}
            </th>
          </tr>
        </thead>
        <tbody>
          {bills.map((b) => (
            <tr
              key={b.id}
              role="button"
              aria-label={t('confirmed.table.rowAction')}
              tabIndex={0}
              className="cursor-pointer border-b last:border-b-0 outline-none focus-visible:bg-accent hover:bg-accent/40"
              onClick={() => onRowClick(b.id)}
              onKeyDown={(e) => onKey(e, () => onRowClick(b.id))}
            >
              <td className="px-3 py-2">{b.bill_date.slice(0, 10)}</td>
              <td className="px-3 py-2 font-mono">{formatAmount(b)}</td>
              <td className="px-3 py-2">
                {b.market?.name ?? t('confirmed.table.noMarket')}
              </td>
              <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                {b.description ?? t('confirmed.table.noMarket')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
