import { useState, type ReactElement } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  onOpenNewBill: () => void;
}

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'block rounded-md px-3 py-2 text-base font-medium',
    isActive
      ? 'bg-accent text-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
  );

export function MobileNav({ onOpenNewBill }: MobileNavProps): ReactElement {
  const { t } = useTranslation('header');
  const [open, setOpen] = useState(false);

  const close = (): void => setOpen(false);

  const handleNewBill = (): void => {
    setOpen(false);
    onOpenNewBill();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={t('menu.openMenu')}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>{t('brand')}</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1">
          <NavLink to="/" end className={linkClass} onClick={close}>
            {t('nav.home')}
          </NavLink>
          <NavLink to="/dashboard" className={linkClass} onClick={close}>
            {t('nav.dashboard')}
          </NavLink>
          <NavLink to="/bills/confirmed" className={linkClass} onClick={close}>
            {t('nav.confirmedBills')}
          </NavLink>
          <button
            type="button"
            onClick={handleNewBill}
            className="mt-2 rounded-md bg-primary px-3 py-2 text-left text-base font-medium text-primary-foreground"
          >
            {t('nav.newBill')}
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
