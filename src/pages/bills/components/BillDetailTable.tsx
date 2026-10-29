import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { SubCategorySelect } from '@/components/categories/SubCategorySelect';
import type { BillDetailResponseDto } from '@/types/bills';
import type { BillDetailDraft } from '../billDetailDraft';

export interface BillDetailTableProps {
  bill: BillDetailResponseDto;
  // Edit mode is on while a draft is given.
  draft: BillDetailDraft | null;
  onDraftChange: (draft: BillDetailDraft) => void;
}

// Summary and items of a bill laid out for the desktop detail page.
export function BillDetailTable({
  bill,
  draft,
  onDraftChange: setDraft,
}: BillDetailTableProps): ReactElement {
  const { t } = useTranslation('bills');
  const money = (value: number): string =>
    t('confirmed.detail.amount', {
      value: value.toFixed(2),
      currency: bill.currency ?? '',
    }).trim();

  const setItem = (
    index: number,
    patch: Partial<BillDetailDraft['items'][number]>
  ): void => {
    if (!draft) return;
    setDraft({
      ...draft,
      items: draft.items.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      ),
    });
  };

  // While editing, the footer follows the typed amounts; junk counts as 0.
  const itemsTotal = draft
    ? draft.items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
    : bill.items.reduce((s, it) => s + it.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-4 gap-4 text-sm">
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">{t('confirmed.table.date')}</dt>
          <dd>
            {draft ? (
              <Input
                type="date"
                aria-label={t('confirmed.table.date')}
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            ) : (
              bill.bill_date.slice(0, 10)
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">
            {t('confirmed.table.total')}
          </dt>
          <dd className="font-mono">
            {draft ? (
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                aria-label={t('confirmed.table.total')}
                className="font-mono"
                value={draft.total}
                onChange={(e) => setDraft({ ...draft, total: e.target.value })}
              />
            ) : (
              money(bill.total_amount)
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">
            {t('confirmed.table.market')}
          </dt>
          <dd>
            {draft ? (
              <Input
                aria-label={t('confirmed.table.market')}
                value={draft.market}
                onChange={(e) => setDraft({ ...draft, market: e.target.value })}
              />
            ) : (
              (bill.market?.name ??
              bill.market_name_raw ??
              t('confirmed.table.noMarket'))
            )}
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
            <table className="w-full min-w-[768px] table-fixed text-sm">
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
                {bill.items.map((item, i) => {
                  const edit = draft?.items[i];
                  return (
                    <tr key={item.id ?? i} className="border-t align-middle">
                      <td className="px-2 py-2 text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="truncate px-2 py-2" title={item.raw_name}>
                        {item.raw_name}
                      </td>
                      <td className="px-2 py-2">
                        {edit ? (
                          <SubCategorySelect
                            aria-label={t('confirmed.detail.itemCategory', {
                              index: i + 1,
                            })}
                            value={edit.subCategory}
                            onChange={(next) =>
                              setItem(i, { subCategory: next })
                            }
                          />
                        ) : item.sub_category ? (
                          `${item.sub_category.category_name} › ${item.sub_category.name}`
                        ) : (
                          t('confirmed.detail.uncategorized')
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {edit ? (
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            inputMode="numeric"
                            aria-label={t('confirmed.detail.itemCount', {
                              index: i + 1,
                            })}
                            value={edit.count}
                            onChange={(e) =>
                              setItem(i, { count: e.target.value })
                            }
                          />
                        ) : (
                          item.product_count
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {edit ? (
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            inputMode="decimal"
                            aria-label={t('confirmed.detail.itemWeight', {
                              index: i + 1,
                            })}
                            value={edit.weight}
                            onChange={(e) =>
                              setItem(i, { weight: e.target.value })
                            }
                          />
                        ) : (
                          (item.product_weight ?? '—')
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-mono">
                        {edit ? (
                          <Input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            className="text-right font-mono"
                            aria-label={t('confirmed.detail.itemAmount', {
                              index: i + 1,
                            })}
                            value={edit.amount}
                            onChange={(e) =>
                              setItem(i, { amount: e.target.value })
                            }
                          />
                        ) : (
                          money(item.amount)
                        )}
                      </td>
                    </tr>
                  );
                })}
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
