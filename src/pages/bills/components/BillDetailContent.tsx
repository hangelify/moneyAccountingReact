import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useBillDetail } from '@/hooks/useBillDetail';
import { ApiError } from '@/auth/apiError';
import { Button } from '@/components/ui/button';

export interface BillDetailContentProps {
  id: string;
}

export function BillDetailContent({
  id,
}: BillDetailContentProps): ReactElement {
  const { t } = useTranslation('bills');
  const q = useBillDetail(id);

  if (q.isLoading) {
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

  const bill = q.data!;
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
          <dd>{bill.market?.name ?? t('confirmed.table.noMarket')}</dd>
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
