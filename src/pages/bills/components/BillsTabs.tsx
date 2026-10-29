import type { ReactElement } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useDraftBills } from '@/hooks/useDraftBills';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/types/pagination';

const tabClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'border-foreground text-foreground'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  );

// Confirmed bills and drafts are separate lists with their own paging, so
// each tab is its own route rather than a filter on one list.
export function BillsTabs(): ReactElement {
  const { t } = useTranslation('bills');
  // Same key as the drafts tab's first page, so the count shares its cache.
  const drafts = useDraftBills(DEFAULT_PAGE, DEFAULT_LIMIT);
  const total = drafts.data?.meta.total;
  return (
    <nav aria-label={t('tabs.label')} className="flex gap-1 border-b">
      <NavLink to="/bills" end className={tabClass}>
        {t('tabs.confirmed')}
      </NavLink>
      <NavLink to="/bills/drafts" className={tabClass}>
        {total != null
          ? t('tabs.draftsCount', { count: total })
          : t('tabs.drafts')}
      </NavLink>
    </nav>
  );
}
