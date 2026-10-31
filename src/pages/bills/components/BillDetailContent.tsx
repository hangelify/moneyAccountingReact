import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useBillDetail } from '@/hooks/useBillDetail';
import { ApiError } from '@/auth/apiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SubCategorySelect } from '@/components/categories/SubCategorySelect';
import type { BillDetailResponseDto } from '@/types/bills';
import type { BillDetailDraft } from '../billDetailDraft';

export interface BillDetailContentProps {
  id: string;
  // Edit mode is on while a draft is given; the parent owns it so that
  // Confirm can send the edited values.
  draft?: BillDetailDraft | null;
  onDraftChange?: (draft: BillDetailDraft) => void;
}

export function BillDetailContent({
  id,
  draft = null,
  onDraftChange = () => undefined,
}: BillDetailContentProps): ReactElement {
  const { t } = useTranslation('bills');
  const q = useBillDetail(id);

  // isPending, not isLoading: the query is disabled (no data, not loading)
  // until the household is known, e.g. on a cold deep link.
  if (q.isPending) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('confirmed.detail.loading')}
      </p>
    );
  }

  if (q.isError) {
    const status = q.error instanceof ApiError ? q.error.status : null;
    if (status === 404 || status === 403) {
      return (
        <p className="text-sm text-muted-foreground">
          {t('confirmed.detail.notFound')}
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-destructive">
          {t('confirmed.detail.loadError')}
        </p>
        <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
          {t('confirmed.filters.retry')}
        </Button>
      </div>
    );
  }

  const bill = q.data;
  if (draft) {
    return (
      <BillDetailEditForm bill={bill} draft={draft} onChange={onDraftChange} />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">{t('confirmed.table.date')}</dt>
          <dd>{bill.bill_date.slice(0, 10)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {t('confirmed.table.total')}
          </dt>
          <dd className="font-mono">
            {t('confirmed.detail.amount', {
              value: bill.total_amount.toFixed(2),
              currency: bill.currency ?? '',
            })}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {t('confirmed.table.market')}
          </dt>
          <dd>
            {bill.market?.name ??
              bill.market_name_raw ??
              t('confirmed.table.noMarket')}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">
            {t('confirmed.table.description')}
          </dt>
          <dd>{bill.description ?? '—'}</dd>
        </div>
      </dl>

      <section>
        <h3 className="mb-2 text-sm font-semibold">
          {t('confirmed.detail.items')}
        </h3>
        {bill.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('confirmed.detail.noItems')}
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {bill.items.map((item, i) => (
              <li
                key={`${item.sub_category?.id ?? 'none'}-${i}`}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span>
                    {item.sub_category
                      ? `${item.sub_category.category_name} › ${item.sub_category.name}`
                      : t('confirmed.detail.uncategorized')}
                  </span>
                  {item.product_weight != null && (
                    <span className="text-xs text-muted-foreground">
                      {t('confirmed.detail.weight', {
                        value: item.product_weight,
                      })}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-mono">
                    {t('confirmed.detail.amount', {
                      value: item.amount.toFixed(2),
                      currency: bill.currency ?? '',
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    × {item.product_count}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BillDetailEditForm({
  bill,
  draft,
  onChange: setDraft,
}: {
  bill: BillDetailResponseDto;
  draft: BillDetailDraft;
  onChange: (draft: BillDetailDraft) => void;
}): ReactElement {
  const { t } = useTranslation('bills');

  const setItem = (
    index: number,
    patch: Partial<BillDetailDraft['items'][number]>
  ): void => {
    setDraft({
      ...draft,
      items: draft.items.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      ),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">
            {t('confirmed.table.date')}
          </span>
          <Input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">
            {t('confirmed.table.total')}
          </span>
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            className="font-mono"
            value={draft.total}
            onChange={(e) => setDraft({ ...draft, total: e.target.value })}
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-muted-foreground">
            {t('confirmed.table.market')}
          </span>
          <Input
            value={draft.market}
            onChange={(e) => setDraft({ ...draft, market: e.target.value })}
          />
        </label>
        <div className="col-span-2 flex flex-col gap-1">
          <span className="text-muted-foreground">
            {t('confirmed.table.description')}
          </span>
          <span>{bill.description ?? '—'}</span>
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold">
          {t('confirmed.detail.items')}
        </h3>
        {bill.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('confirmed.detail.noItems')}
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {draft.items.map((item, i) => {
              // Key by the loaded item so changing the category keeps the row.
              const sub = bill.items[i]?.sub_category;
              return (
                <li
                  key={`${sub?.id ?? 'none'}-${i}`}
                  className="flex flex-col gap-2 px-3 py-2 text-sm"
                >
                  <SubCategorySelect
                    aria-label={t('confirmed.detail.itemCategory', {
                      index: i + 1,
                    })}
                    value={item.subCategory}
                    onChange={(next) => setItem(i, { subCategory: next })}
                  />
                  <div
                    aria-hidden
                    className="-mb-1 grid grid-cols-3 gap-2 text-xs text-muted-foreground"
                  >
                    <span>{t('confirmed.detail.amountColumn')}</span>
                    <span>{t('confirmed.detail.countColumn')}</span>
                    <span>{t('confirmed.detail.weightColumn')}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      className="font-mono"
                      aria-label={t('confirmed.detail.itemAmount', {
                        index: i + 1,
                      })}
                      value={item.amount}
                      onChange={(e) => setItem(i, { amount: e.target.value })}
                    />
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      inputMode="numeric"
                      aria-label={t('confirmed.detail.itemCount', {
                        index: i + 1,
                      })}
                      value={item.count}
                      onChange={(e) => setItem(i, { count: e.target.value })}
                    />
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      inputMode="decimal"
                      aria-label={t('confirmed.detail.itemWeight', {
                        index: i + 1,
                      })}
                      value={item.weight}
                      onChange={(e) => setItem(i, { weight: e.target.value })}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
