// src/pages/bills/BillDetailDrawer.tsx
import { useState, type ReactElement } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useBillDetail } from '@/hooks/useBillDetail';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { BillDetailContent } from './components/BillDetailContent';

export function BillDetailDrawer(): ReactElement | null {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('bills');
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const bill = useBillDetail(id).data;
  // Keyed by bill id so opening another bill leaves edit mode.
  const [editingId, setEditingId] = useState<string | null>(null);
  const isEditing = editingId !== null && editingId === id;

  if (!id) return null;

  const handleOpenChange = (next: boolean): void => {
    if (!next) void navigate({ pathname: '..', search: location.search });
  };

  return (
    <Sheet open onOpenChange={handleOpenChange}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        // Only the bottom sheet is capped; the side sheet spans full height.
        className={cn(
          'flex flex-col gap-4 overflow-y-auto sm:max-w-md',
          !isDesktop && 'max-h-[90vh]'
        )}
      >
        <SheetHeader>
          <SheetTitle>{t('confirmed.detail.title')}</SheetTitle>
          {bill && (
            // Confirm and Remove are wired in a follow-up; disabled until then.
            <div className="flex gap-2 pr-6">
              {bill.status === 'draft' && (
                <Button size="sm" disabled>
                  {t('confirmed.detail.confirm')}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingId(isEditing ? null : id)}
              >
                {isEditing
                  ? t('confirmed.detail.cancel')
                  : t('confirmed.detail.edit')}
              </Button>
            </div>
          )}
        </SheetHeader>
        <BillDetailContent id={id} isEditing={isEditing} />
        {bill && (
          <Button variant="destructive" className="mt-auto w-full" disabled>
            {t('confirmed.detail.remove')}
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
