// src/pages/bills/BillDetailPage.tsx
import { useEffect, useRef, type ReactElement } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBillDetail } from '@/hooks/useBillDetail';
import { ApiError } from '@/auth/apiError';
import { BillDetailTable } from './components/BillDetailTable';
import { useBillDetailActions } from './useBillDetailActions';

// Desktop layout of a bill: a full page with the items in a table.
export function BillDetailPage(): ReactElement | null {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('bills');
  const q = useBillDetail(id);
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
      <BillDetailTable bill={q.data} draft={draft} onDraftChange={setDraft} />
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
            {bill.status === 'draft' && (
              <Button disabled={!canConfirm} onClick={confirm}>
                {t('confirmed.detail.confirm')}
              </Button>
            )}
            <Button
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
      </header>

      {renderBody()}

      {bill && (
        // Remove is wired in a follow-up; disabled until then.
        <Button variant="destructive" className="self-end" disabled>
          {t('confirmed.detail.remove')}
        </Button>
      )}
    </div>
  );
}
