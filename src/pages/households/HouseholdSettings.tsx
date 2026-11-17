import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingFallback } from '@/components/common/LoadingFallback';
import { Button } from '@/components/ui/button';
import { useHouseholds } from '@/contexts/HouseholdContext';
import { HouseholdEditor } from './HouseholdEditor';

export function HouseholdSettings(): ReactElement {
  const { t } = useTranslation('households');
  const { status, activeHousehold, refetch } = useHouseholds();

  if (status === 'idle' || status === 'loading') return <LoadingFallback />;

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {t('settings.title')}
        </h1>
        {activeHousehold ? (
          // A new household starts a fresh form.
          <HouseholdEditor
            key={activeHousehold.id}
            household={activeHousehold}
          />
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground">{t('loadFailed')}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetch()}
            >
              {t('retry')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
