import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import type { ReactElement } from 'react';

export function Home(): ReactElement {
  const { t } = useTranslation('common');
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated && user) {
    const name = user.first_name || user.email;
    return (
      <div className="container mx-auto px-4 py-10 sm:py-16">
        <div className="mx-auto max-w-xl space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold sm:text-4xl">
              {t('home.greetingAuthed', { name })}
            </h1>
            <p className="text-muted-foreground">{t('home.subtitleAuthed')}</p>
          </div>
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/dashboard">{t('home.ctaDashboard')}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold sm:text-4xl">
            {t('home.headlineGuest')}
          </h1>
          <p className="text-muted-foreground">{t('home.subtitleGuest')}</p>
        </div>
        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row">
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">{t('home.ctaLogin')}</Link>
          </Button>
          <Button size="lg" asChild>
            <Link to="/register">{t('home.ctaRegister')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
