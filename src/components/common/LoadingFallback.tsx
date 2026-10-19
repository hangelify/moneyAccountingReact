import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

export function LoadingFallback(): ReactElement {
  const { t } = useTranslation('common');

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">{t('loading')}</p>
      </div>
    </div>
  );
}
