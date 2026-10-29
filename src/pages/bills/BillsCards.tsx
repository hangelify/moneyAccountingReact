import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useDraftBills } from '@/hooks/useDraftBills';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/types/pagination';
import { BillsListPage } from './BillsListPage';
import { BillCardGrid } from './components/BillCardGrid';
import { BillsTabs } from './components/BillsTabs';

export function BillsCards(): ReactElement {
  const { t } = useTranslation('bills');
  const drafts = useDraftBills(DEFAULT_PAGE, DEFAULT_LIMIT);
  const draftsTotal = drafts.data?.meta.total ?? 0;
  return (
    <BillsListPage
      title={t('cards.title')}
      header={<BillsTabs />}
      emptyNoBills={
        draftsTotal > 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border bg-card p-6">
            <Button asChild size="sm">
              <Link to="/bills/drafts">
                {t('drafts.toReview', { count: draftsTotal })}
              </Link>
            </Button>
          </div>
        ) : undefined
      }
      renderBills={(bills, openBill) => (
        <BillCardGrid bills={bills} onCardClick={openBill} />
      )}
    />
  );
}
