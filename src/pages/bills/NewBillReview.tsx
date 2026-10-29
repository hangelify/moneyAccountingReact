import { useEffect, useState, type ReactElement } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { BillReviewFields } from './components/BillReviewFields';
import { BillItemsTable } from './components/BillItemsTable';
import { BillTotalsBanner } from './components/BillTotalsBanner';
import { useBillDraftStore } from '@/stores/billDraftStore';
import { toast } from '@/hooks/use-toast';

export function NewBillReview(): ReactElement | null {
  const { t } = useTranslation(['bills', 'common']);
  const navigate = useNavigate();

  const file = useBillDraftStore((s) => s.file);
  const previewUrl = useBillDraftStore((s) => s.previewUrl);
  const edits = useBillDraftStore((s) => s.edits);
  const updateEdits = useBillDraftStore((s) => s.updateEdits);
  const updateItem = useBillDraftStore((s) => s.updateItem);
  const removeItem = useBillDraftStore((s) => s.removeItem);
  const addItem = useBillDraftStore((s) => s.addItem);
  const clear = useBillDraftStore((s) => s.clear);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => {
      // Runs on every unmount. When we unmounted via the <Navigate>
      // redirect path below, the store is already empty, so clear() is
      // a harmless no-op. On the normal leave path (Cancel, logout,
      // nav away), this revokes the preview URL and resets state.
      clear();
    };
    // clear is stable by reference; intentional empty deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (file === null || previewUrl === null) {
    if (!mounted) toast({ title: t('bills:review.noDraftRedirect') });
    return <Navigate to="/" replace />;
  }

  const handleEditsChange = (patch: Partial<typeof edits>): void => {
    setDirty(true);
    updateEdits(patch);
  };

  const handleItemChange = (
    i: number,
    patch: Parameters<typeof updateItem>[1]
  ): void => {
    setDirty(true);
    updateItem(i, patch);
  };

  const handleCancel = (): void => {
    if (dirty) {
      setConfirmCancel(true);
    } else {
      void navigate('/dashboard');
    }
  };

  const handleDiscard = (): void => {
    setConfirmCancel(false);
    void navigate('/dashboard');
  };

  const handleSave = (): void => {
    // TODO: wire to backend save endpoint when it ships.
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="container mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">{t('bills:review.title')}</h1>
          <p className="text-muted-foreground">
            {t('bills:review.description')}
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="md:sticky md:top-20 md:self-start">
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <img
                src={previewUrl}
                alt="Uploaded bill"
                className="max-h-80 w-full rounded-md border object-contain md:max-h-[70vh]"
              />
            </a>
          </div>

          <div className="space-y-6">
            <BillReviewFields edits={edits} onChange={handleEditsChange} />
            <BillTotalsBanner
              items={edits.items}
              totalAmount={edits.total_amount}
              currency={edits.currency}
            />
            <BillItemsTable
              items={edits.items}
              onUpdateItem={handleItemChange}
              onRemoveItem={(i) => {
                setDirty(true);
                removeItem(i);
              }}
              onAddItem={() => {
                setDirty(true);
                return addItem();
              }}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={handleCancel}>
                {t('common:actions.cancel')}
              </Button>
              <Button type="button" onClick={handleSave}>
                {t('common:actions.save')}
              </Button>
            </div>
          </div>
        </div>

        <ConfirmDialog
          open={confirmCancel}
          onOpenChange={setConfirmCancel}
          title={t('bills:review.discardTitle')}
          description={t('bills:review.discardDescription')}
          confirmLabel={t('common:actions.discard')}
          variant="destructive"
          onConfirm={handleDiscard}
        />
      </div>
    </TooltipProvider>
  );
}
