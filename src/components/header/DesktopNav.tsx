import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReactElement } from 'react';

interface DesktopNavProps {
  onOpenNewBill: () => void;
}

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'text-sm font-medium transition-colors',
    isActive
      ? 'text-foreground underline underline-offset-4'
      : 'text-muted-foreground hover:text-foreground'
  );

export function DesktopNav({ onOpenNewBill }: DesktopNavProps): ReactElement {
  const { t } = useTranslation('header');
  return (
    <nav className="hidden items-center gap-6 md:flex">
      <NavLink to="/" end className={navLinkClass}>
        {t('nav.home')}
      </NavLink>
      <NavLink to="/dashboard" className={navLinkClass}>
        {t('nav.dashboard')}
      </NavLink>
      <NavLink to="/bills/confirmed" className={navLinkClass}>
        {t('nav.confirmedBills')}
      </NavLink>
      <Button variant="default" size="sm" onClick={onOpenNewBill}>
        {t('nav.newBill')}
      </Button>
    </nav>
  );
}
