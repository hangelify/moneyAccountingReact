// src/pages/bills/BillDetailPage.tsx
import { useEffect, useRef, type ReactElement } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBillDetail } from '@/hooks/useBillDetail';
import { ApiError } from '@/auth/apiError';
import { BillDescription } from './components/BillDescription';
import { BillDetailTable } from './components/BillDetailTable';
import { BillEditForm } from './components/BillEditForm';
import { SavedBillTotalsBanner } from './components/BillTotalsBanner';
import { BillDetailViews } from './components/BillDetailViews';
import { BillDuplicateSection } from './components/BillDuplicateSection';
import { FailedBillNotice } from './components/FailedBillNotice';
import { DeleteBillButton } from './components/DeleteBillButton';
import { useBillDetailActions } from './useBillDetailActions';

// Desktop layout of a bill: a full page with the items in a table.
export function BillDetailPage(): ReactElement | null {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('bills');
  const q = useBillDetail(id);
  const actions = useBillDetailActions(id);
  const {
    bill,
    edits,
    setEdits,
    isEdited,
    isFailed,
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
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The page replaces the list: start at the top and move focus to the page.
  useEffect(() => {
    window.scrollTo(0, 0);
    headingRef.current?.focus();
  }, [id]);

  if (!id) return null;

  const renderBody = (): ReactElement => {
    // isPending, not isLoading: the query is disabled (no data, not loading)
    // until the household is known, e.g. on a cold deep link.
    if (q.isPending) {
      return (
        <p className="text-sm text-muted-foreground">
          {t('confirmed.detail.loading')}
        </p>
      );
    }
    if (q.isError) {
      const status = q.error instanceof ApiError ? q.error.status : null;
      if (status === 404 || status === 403) {
        return (
          <p className="text-sm text-muted-foreground">
            {t('confirmed.detail.notFound')}
          </p>
        );
      }
      return (
        <div className="flex items-center gap-2">
          <p className="text-sm text-destructive">
            {t('confirmed.detail.loadError')}
          </p>
          <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
            {t('confirmed.filters.retry')}
          </Button>
        </div>
      );
    }
    return (
      <>
        {isFailed && <FailedBillNotice bill={q.data} />}
        {!isFailed && <BillDuplicateSection bill={q.data} actions={actions} />}
        {edits === null && <SavedBillTotalsBanner bill={q.data} />}
        <BillDetailViews key={id} bill={q.data} editing={edits !== null}>
          {edits ? (
            <div className="flex flex-col gap-4">
              <BillDescription bill={q.data} />
              <BillEditForm edits={edits} onChange={setEdits} />
            </div>
          ) : (
            <BillDetailTable bill={q.data} />
          )}
        </BillDetailViews>
      </>
    );
  };

  return (
    <div className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:py-8">
      <header className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={close}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('confirmed.detail.back')}
        </Button>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold outline-none"
        >
          {t('confirmed.detail.title')}
        </h1>
        {bill && (
          <div className="ml-auto flex gap-2">
            {(bill.status === 'draft' || isFailed) && (
              <Button disabled={!canConfirm} onClick={confirm}>
                {t('confirmed.detail.confirm')}
              </Button>
            )}
            {edits && (
              <Button disabled={!canSave} onClick={save}>
                {t('confirmed.detail.save')}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={
                isConfirming ||
                isSaving ||
                isRemoving ||
                ((bill.status === 'draft' || isFailed) && !isEdited)
              }
              onClick={toggleEdit}
            >
              {bill.status === 'draft' || isFailed
                ? t('confirmed.detail.reset')
                : edits
                  ? t('confirmed.detail.cancel')
                  : t('confirmed.detail.edit')}
            </Button>
          </div>
        )}
      </header>

      {renderBody()}

      {bill && (
        <DeleteBillButton
          bill={bill}
          onDelete={remove}
          disabled={!canRemove}
          className="self-end"
        />
      )}
    </div>
  );
}
