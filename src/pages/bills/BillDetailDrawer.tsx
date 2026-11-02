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
import { BillDuplicateSection } from './components/BillDuplicateSection';
import { DeleteBillButton } from './components/DeleteBillButton';
import { useBillDetailActions } from './useBillDetailActions';

export function BillDetailDrawer(): ReactElement | null {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('bills');
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const actions = useBillDetailActions(id);
  const {
    bill,
    draft,
    setDraft,
    toggleEdit,
    confirm,
    isConfirming,
    canConfirm,
    save,
    isSaving,
    canSave,
    remove,
    isRemoving,
    canRemove,
    close,
  } = actions;

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
              {draft && (
                <Button size="sm" disabled={!canSave} onClick={save}>
                  {t('confirmed.detail.save')}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={isConfirming || isSaving || isRemoving}
                onClick={toggleEdit}
              >
                {draft
                  ? t('confirmed.detail.cancel')
                  : t('confirmed.detail.edit')}
              </Button>
            </div>
          )}
        </SheetHeader>
        {bill && <BillDuplicateSection bill={bill} actions={actions} />}
        <BillDetailContent id={id} draft={draft} onDraftChange={setDraft} />
        {bill && (
          <DeleteBillButton
            bill={bill}
            onDelete={remove}
            disabled={!canRemove}
            className="mt-auto w-full"
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
