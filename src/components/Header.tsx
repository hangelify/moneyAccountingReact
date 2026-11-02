import { useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { DesktopNav } from '@/components/header/DesktopNav';
import { MobileNav } from '@/components/header/MobileNav';
import { UserMenu } from '@/components/header/UserMenu';
import { NewBillModal } from '@/components/bills/NewBillModal';

export function Header(): ReactElement {
  const { t } = useTranslation('header');
  const { isAuthenticated } = useAuth();
  const [newBillOpen, setNewBillOpen] = useState(false);

  const openNewBill = (): void => setNewBillOpen(true);

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="container mx-auto flex h-14 items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-4">
          {isAuthenticated && <MobileNav onOpenNewBill={openNewBill} />}
          <Link to="/" className="text-lg font-semibold">
            {t('brand')}
          </Link>
          {isAuthenticated && <DesktopNav onOpenNewBill={openNewBill} />}
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <div className="hidden md:block">
                <UserMenu />
              </div>
              <div className="md:hidden">
                <UserMenu compact />
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/login">{t('auth.login')}</Link>
              </Button>
              <Button asChild>
                <Link to="/register">{t('auth.register')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      {isAuthenticated && (
        <NewBillModal open={newBillOpen} onOpenChange={setNewBillOpen} />
      )}
    </header>
  );
}
