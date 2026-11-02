import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { BillDetailResponseDto } from '@/types/bills';
import { HouseholdTotal } from './HouseholdTotal';

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
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[44rem] table-fixed text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="w-10 px-2 py-2">#</th>
                  <th className="w-[28%] px-2 py-2">
                    {t('confirmed.detail.nameColumn')}
                  </th>
                  <th className="w-[30%] px-2 py-2">
                    {t('confirmed.detail.categoryColumn')}
                  </th>
                  <th className="w-[10%] px-2 py-2">
                    {t('confirmed.detail.countColumn')}
                  </th>
                  <th className="w-[12%] px-2 py-2">
                    {t('confirmed.detail.weightColumn')}
                  </th>
                  <th className="w-[14%] px-2 py-2 text-right">
                    {t('confirmed.detail.amountColumn')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map((item, i) => (
                  <tr key={item.id ?? i} className="border-t align-middle">
                    <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="truncate px-2 py-2" title={item.raw_name}>
                      {item.raw_name}
                    </td>
                    <td className="px-2 py-2">
                      {item.sub_category
                        ? `${item.sub_category.category_name} › ${item.sub_category.name}`
                        : t('confirmed.detail.uncategorized')}
                    </td>
                    <td className="px-2 py-2">{item.product_count}</td>
                    <td className="px-2 py-2">{item.product_weight ?? '—'}</td>
                    <td className="px-2 py-2 text-right font-mono">
                      {money(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30 font-medium">
                <tr>
                  <td className="px-2 py-2" />
                  <td colSpan={4} className="px-2 py-2">
                    {t('confirmed.detail.itemsTotal')}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {money(itemsTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
