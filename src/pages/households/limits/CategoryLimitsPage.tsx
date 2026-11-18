import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { LoadingFallback } from '@/components/common/LoadingFallback';
import { Button } from '@/components/ui/button';
import { useHouseholds } from '@/contexts/HouseholdContext';
import { useCategoryLimitsQuery } from '@/hooks/useCategoryLimits';
import { useHouseholdCategories } from '@/hooks/useCategoryTree';
import type { Household } from '@/types/households';
import { LimitRow } from './LimitRow';
import { buildLimitRows } from './limitRows';

/** `/households/:id/limits`: the spending limits of one budget. */
export function CategoryLimitsPage(): ReactElement {
  const { t } = useTranslation('limits');
  const { id = '' } = useParams();
  const { status, households } = useHouseholds();

  if (status === 'idle' || status === 'loading') return <LoadingFallback />;
  const household = households.find((h) => h.id === id);
  if (!household) {
    return (
      <PageShell>
        <p className="text-muted-foreground">{t('page.notFound')}</p>
        <Link to="/households" className="text-sm underline">
          {t('page.backToList')}
        </Link>
      </PageShell>
    );
  }
  return <LimitsOf household={household} />;
}

function PageShell({
  children,
}: {
  children: ReactElement[] | ReactElement;
}): ReactElement {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-2xl space-y-4">{children}</div>
    </div>
  );
}

function LimitsOf({ household }: { household: Household }): ReactElement {
  const { t } = useTranslation('limits');
  const categories = useHouseholdCategories(household.id);
  const limits = useCategoryLimitsQuery(household.id);
  const [editingId, setEditingId] = useState<string | null>(null);

  const header = (
    <div className="space-y-1">
      <Link
        to="/households"
        className="text-sm text-muted-foreground underline"
      >
        ← {t('page.back')}
      </Link>
      <h1 className="text-2xl font-bold sm:text-3xl">
        {t('page.title', { name: household.name })}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t('page.currency', { currency: household.currency })}
      </p>
    </div>
  );

  if (categories.isError || limits.isError) {
    return (
      <PageShell>
        {header}
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground">{t('page.loadFailed')}</p>
          <Button
            size="sm"
            onClick={() => {
              void categories.refetch();
              void limits.refetch();
            }}
          >
            {t('page.retry')}
          </Button>
        </div>
      </PageShell>
    );
  }
  if (categories.isPending || limits.isPending) return <LoadingFallback />;

  const rows = buildLimitRows(categories.data, limits.data, household.currency);
  return (
    <PageShell>
      {header}
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{t('page.empty')}</p>
      ) : (
        <ul className="rounded-lg border bg-card px-4">
          {rows.map((row) => (
            <LimitRow
              key={row.categoryId}
              hid={household.id}
              row={row}
              currency={household.currency}
              editing={editingId === row.categoryId}
              onEdit={() => {
                setEditingId(row.categoryId);
              }}
              onDone={() => {
                setEditingId(null);
              }}
            />
          ))}
        </ul>
      )}
    </PageShell>
  );
}
