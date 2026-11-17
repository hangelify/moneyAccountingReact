import { useId, useRef, useState, type ReactElement } from 'react';
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
  const headingRef = useRef<HTMLHeadingElement>(null);

  if (status === 'idle' || status === 'loading') return <LoadingFallback />;

  const newButton = (
    <NewBudgetButton
      atLimit={households.length >= MAX_HOUSEHOLDS}
      onClick={() => setCreating(true)}
    />
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
      <div className="space-y-3">
        {households.map((h) => (
          <HouseholdCard
            key={h.id}
            household={h}
            active={h.id === activeHousehold?.id}
            onDeleted={() => headingRef.current?.focus()}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-bold outline-none sm:text-3xl"
          >
            {t('list.title')}
          </h1>
          {status === 'ready' && newButton}
        </div>
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

/** "New budget", disabled at the limit with the reason linked to it. */
function NewBudgetButton({
  atLimit,
  onClick,
}: {
  atLimit: boolean;
  onClick: () => void;
}): ReactElement {
  const { t } = useTranslation('households');
  const hintId = useId();
  return (
    <div className="flex items-center gap-3">
      {atLimit && (
        <span id={hintId} className="text-sm text-muted-foreground">
          {t('limitReached')}
        </span>
      )}
      <Button
        type="button"
        disabled={atLimit}
        aria-describedby={atLimit ? hintId : undefined}
        onClick={onClick}
      >
        {t('list.new')}
      </Button>
    </div>
  );
}
