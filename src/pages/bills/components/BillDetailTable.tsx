import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { BillDetailResponseDto } from '@/types/bills';
import { HouseholdTotal } from './HouseholdTotal';
import { formatLineCategory } from '@/lib/lineCategory';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface BillDetailTableProps {
  bill: BillDetailResponseDto;
}

// Summary and items of a saved bill laid out for the desktop detail page.
export function BillDetailTable({ bill }: BillDetailTableProps): ReactElement {
  const { t } = useTranslation('bills');
  const money = (value: number): string =>
    t('confirmed.detail.amount', {
      value: value.toFixed(2),
      currency: bill.currency ?? '',
    }).trim();

  const itemsTotal = bill.items.reduce((s, it) => s + it.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-4 gap-4 text-sm">
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">{t('confirmed.table.date')}</dt>
          <dd>{bill.bill_date.slice(0, 10)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">
            {t('confirmed.table.total')}
          </dt>
          <dd className="font-mono">
            {money(bill.total_amount)}
            <HouseholdTotal bill={bill} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">
            {t('confirmed.table.market')}
          </dt>
          <dd>
            {bill.market?.name ??
              bill.market_name_raw ??
              t('confirmed.table.noMarket')}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">
            {t('confirmed.table.description')}
          </dt>
          <dd>{bill.description ?? '—'}</dd>
        </div>
      </dl>

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          {t('confirmed.detail.items')}
        </h2>
        {bill.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('confirmed.detail.noItems')}
          </p>
        ) : (
          <Table density="compact" className="min-w-[44rem] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 font-bold">#</TableHead>
                <TableHead className="w-[28%] font-bold">
                  {t('confirmed.detail.nameColumn')}
                </TableHead>
                <TableHead className="w-[30%] font-bold">
                  {t('confirmed.detail.categoryColumn')}
                </TableHead>
                <TableHead className="w-[10%] font-bold">
                  {t('confirmed.detail.countColumn')}
                </TableHead>
                <TableHead className="w-[12%] font-bold">
                  {t('confirmed.detail.weightColumn')}
                </TableHead>
                <TableHead numeric className="w-[14%] font-bold">
                  {t('confirmed.detail.amountColumn')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bill.items.map((item, i) => (
                <TableRow key={item.id ?? i} className="align-middle">
                  <TableCell className="text-muted-foreground">
                    {i + 1}
                  </TableCell>
                  <TableCell className="truncate" title={item.raw_name}>
                    {item.raw_name}
                  </TableCell>
                  <TableCell>
                    {formatLineCategory(item) ??
                      t('confirmed.detail.uncategorized')}
                  </TableCell>
                  <TableCell>{item.product_count}</TableCell>
                  <TableCell>{item.product_weight ?? '—'}</TableCell>
                  <TableCell numeric className="font-mono">
                    {money(item.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell />
                <TableCell colSpan={4}>
                  {t('confirmed.detail.itemsTotal')}
                </TableCell>
                <TableCell numeric className="font-mono">
                  {money(itemsTotal)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </section>
    </div>
  );
}
