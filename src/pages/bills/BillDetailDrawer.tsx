// src/pages/bills/BillDetailDrawer.tsx
import type { ReactElement } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { BillDetailContent } from './components/BillDetailContent';
import { useBillDetailActions } from './useBillDetailActions';

export function BillDetailDrawer(): ReactElement | null {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('bills');
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const {
    bill,
    draft,
    setDraft,
    toggleEdit,
    confirm,
    isConfirming,
    canConfirm,
    close,
  } = useBillDetailActions(id);

  if (!id) return null;

  const handleOpenChange = (next: boolean): void => {
    if (!next) close();
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
            <div className="flex gap-2 pr-6">
              {bill.status === 'draft' && (
                <Button size="sm" disabled={!canConfirm} onClick={confirm}>
                  {t('confirmed.detail.confirm')}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={isConfirming}
                onClick={toggleEdit}
              >
                {draft
                  ? t('confirmed.detail.cancel')
                  : t('confirmed.detail.edit')}
              </Button>
            </div>
          )}
        </SheetHeader>
        <BillDetailContent id={id} draft={draft} onDraftChange={setDraft} />
        {bill && (
          // Remove is wired in a follow-up; disabled until then.
          <Button variant="destructive" className="mt-auto w-full" disabled>
            {t('confirmed.detail.remove')}
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
