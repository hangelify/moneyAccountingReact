// src/pages/bills/BillDetailDrawer.tsx
import type { ReactElement } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { BillDetailContent } from './components/BillDetailContent';

export function BillDetailDrawer(): ReactElement | null {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('bills');
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (!id) return null;

  const handleOpenChange = (next: boolean): void => {
    if (!next) void navigate({ pathname: '..', search: location.search });
  };

  return (
    <Sheet open onOpenChange={handleOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className="flex max-h-[90vh] flex-col gap-4 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>{t('confirmed.detail.title')}</SheetTitle>
        </SheetHeader>
        <BillDetailContent id={id} />
      </SheetContent>
    </Sheet>
  );
}
