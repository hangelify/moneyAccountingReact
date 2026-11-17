import { useId, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useHouseholds } from '@/contexts/HouseholdContext';
import type { Household } from '@/types/households';

interface HouseholdCardProps {
  household: Household;
  active: boolean;
}

export function HouseholdCard({
  household,
  active,
}: HouseholdCardProps): ReactElement {
  const { t } = useTranslation('households');
  const { setActiveHouseholdId } = useHouseholds();
  const titleId = useId();

  return (
    <article
      aria-labelledby={titleId}
      className="space-y-2 rounded-lg border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id={titleId} className="truncate font-semibold">
            {household.name}
          </h2>
          {household.original_name !== household.name && (
            <p className="text-xs text-muted-foreground">
              {t('card.originalName', { name: household.original_name })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-muted px-2 py-0.5">
            {t(household.role === 'owner' ? 'card.owner' : 'card.member')}
          </span>
          {active && (
            <span className="rounded bg-primary px-2 py-0.5 text-primary-foreground">
              {t('card.active')}
            </span>
          )}
        </div>
      </div>
      <p className="flex gap-3 text-sm text-muted-foreground">
        <span>{household.currency}</span>
        <span>{t('billCount', { count: household.bill_count })}</span>
      </p>
      {!active && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setActiveHouseholdId(household.id)}
        >
          {t('card.makeActive')}
        </Button>
      )}
    </article>
  );
}
