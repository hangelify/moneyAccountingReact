import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { BillReviewFields } from './components/BillReviewFields';
import { BillItemsTable } from './components/BillItemsTable';
import { BillTotalsBanner } from './components/BillTotalsBanner';
import { useBillDraftStore } from '@/stores/billDraftStore';
import { toast } from '@/hooks/use-toast';
import { useHouseholds } from '@/contexts/HouseholdContext';
import { ApiError } from '@/auth/apiError';
import { isHouseholdForbidden } from '@/auth/isHouseholdForbidden';
import { billsApi } from './api';
import { buildConfirmPayload, buildCreatePayload } from './buildConfirmPayload';

export function NewBillReview(): ReactElement | null {
  const { t } = useTranslation(['bills', 'common', 'errors']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { households, activeHousehold, handleForbidden } = useHouseholds();

  const file = useBillDraftStore((s) => s.file);
  const previewUrl = useBillDraftStore((s) => s.previewUrl);
  const edits = useBillDraftStore((s) => s.edits);
  const updateEdits = useBillDraftStore((s) => s.updateEdits);
  const updateItem = useBillDraftStore((s) => s.updateItem);
  const removeItem = useBillDraftStore((s) => s.removeItem);
  const addItem = useBillDraftStore((s) => s.addItem);
  const clear = useBillDraftStore((s) => s.clear);
  const hid = useBillDraftStore((s) => s.hid);
  const draftId = useBillDraftStore((s) => s.draftId);
  const mode = useBillDraftStore((s) => s.mode);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Set before clear() on purposeful exits, so the empty-store redirect to /
  // below doesn't race the navigate() that follows.
  const leaving = useRef(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (hid === null) return;
      if (mode === 'confirm' && draftId !== null) {
        await billsApi.confirm(hid, draftId, buildConfirmPayload(edits));
      } else {
        await billsApi.create(hid, buildCreatePayload(edits));
      }
    },
    onSuccess: () => {
      const savedHid = hid;
      leaving.current = true;
      clear();
      void queryClient.invalidateQueries({
        queryKey: ['households', savedHid, 'bills'],
      });
      // A save can create a market.
      void queryClient.invalidateQueries({
        queryKey: ['households', savedHid, 'markets'],
      });
      toast({ title: t('bills:review.saved') });
      void navigate('/bills/confirmed');
    },
    onError: (err) => {
      if (isHouseholdForbidden(err)) {
        void handleForbidden(err);
        leaving.current = true;
        clear();
        void navigate('/dashboard');
        return;
      }
      const status = err instanceof ApiError ? err.status : undefined;
      if (status === 400 && err instanceof ApiError) {
        setSaveErrors(err.messages);
      } else if (status === 404 && mode === 'confirm') {
        toast({ variant: 'destructive', title: t('bills:review.draftGone') });
        leaving.current = true;
        clear();
        void navigate('/dashboard');
      } else if (status === 409 && mode === 'confirm') {
        toast({
          variant: 'destructive',
          title: t('bills:review.alreadyConfirmed'),
        });
        leaving.current = true;
        clear();
        void navigate('/bills/confirmed');
      } else {
        toast({ variant: 'destructive', title: t('errors:saveFailed') });
      }
    },
  });

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
    if (leaving.current) return null;
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

  // Deletes the server draft (confirm mode only) without waiting for it;
  // the backend expires stale drafts anyway.
  const leave = (): void => {
    if (saveMutation.isPending) return;
    if (hid !== null && draftId !== null) {
      void billsApi.remove(hid, draftId).catch(() => undefined);
    }
    leaving.current = true;
    clear();
    void navigate('/dashboard');
  };

  const handleCancel = (): void => {
    if (dirty) {
      setConfirmCancel(true);
    } else {
      leave();
    }
  };

  const handleDiscard = (): void => {
    setConfirmCancel(false);
    leave();
  };

  const handleSave = (): void => {
    setSaveErrors([]);
    saveMutation.mutate();
  };

  const otherHousehold = hid !== activeHousehold?.id;
  const otherHouseholdName = households.find((h) => h.id === hid)?.name;
  const createMode = mode === 'create';
  const uncategorised =
    createMode && edits.items.some((item) => item.sub_category === null);
  const saveDisabled =
    saveMutation.isPending || otherHousehold || uncategorised;

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
            <BillReviewFields
              edits={edits}
              onChange={handleEditsChange}
              {...(createMode
                ? { marketHint: t('bills:review.marketNotSaved') }
                : {})}
            />
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
            {otherHousehold && (
              <p role="alert" className="text-sm text-destructive">
                {otherHouseholdName === undefined
                  ? t('bills:review.otherHouseholdUnknown')
                  : t('bills:review.otherHousehold', {
                      name: otherHouseholdName,
                    })}
              </p>
            )}
            {uncategorised && (
              <p className="text-sm text-muted-foreground">
                {t('bills:review.categoriseAll')}
              </p>
            )}
            {saveErrors.length > 0 && (
              <ul role="alert" className="space-y-1 text-sm text-destructive">
                {saveErrors.map((m, i) => (
                  // The server can repeat a message, so the index is the key.
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={saveMutation.isPending}
              >
                {t('common:actions.cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saveDisabled}
              >
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
