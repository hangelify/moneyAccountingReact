import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingFallback } from '@/components/common/LoadingFallback';
import { Button } from '@/components/ui/button';
import { MAX_HOUSEHOLDS } from '@/const/households';
import { useHouseholds } from '@/contexts/HouseholdContext';
import { CreateHouseholdDialog } from './CreateHouseholdDialog';
import { HouseholdCard } from './HouseholdCard';

export function HouseholdsPage(): ReactElement {
  const { t } = useTranslation('households');
  const { status, households, activeHousehold, refetch } = useHouseholds();
  const [creating, setCreating] = useState(false);

  if (status === 'idle' || status === 'loading') return <LoadingFallback />;

  const atLimit = households.length >= MAX_HOUSEHOLDS;
  const newButton = (
    <Button type="button" disabled={atLimit} onClick={() => setCreating(true)}>
      {t('list.new')}
    </Button>
  );

  let body: ReactElement;
  if (status === 'error') {
    body = (
      <div role="alert" className="flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground">{t('loadFailed')}</p>
        <Button size="sm" onClick={() => void refetch()}>
          {t('retry')}
        </Button>
      </div>
    );
  } else if (status === 'empty') {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">{t('list.emptyTitle')}</p>
        {newButton}
      </div>
    );
  } else {
    body = (
      <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">{t('list.title')}</h1>
          <div className="flex items-center gap-3">
            {atLimit && (
              <span className="text-sm text-muted-foreground">
                {t('limitReached')}
              </span>
            )}
            {newButton}
          </div>
        </div>
        <div className="space-y-3">
          {households.map((h) => (
            <HouseholdCard
              key={h.id}
              household={h}
              active={h.id === activeHousehold?.id}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {body}
        <CreateHouseholdDialog
          open={creating}
          onOpenChange={setCreating}
          defaultCurrency={activeHousehold?.currency ?? 'EUR'}
        />
      </div>
    </div>
  );
}
