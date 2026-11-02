import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { SpendingBreakdownCard } from './components/SpendingBreakdownCard';

export function Dashboard(): ReactElement {
  const { t } = useTranslation('header');
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {t('nav.dashboard')}
          </h1>
        </div>
        <SpendingBreakdownCard />
      </div>
    </div>
  );
}
