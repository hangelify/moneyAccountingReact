import type { ReactElement } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useDraftBills } from '@/hooks/useDraftBills';
import {
  EMPTY_DUPLICATE_RANGE,
  useDuplicateSuggestions,
} from '@/hooks/useDuplicateSuggestions';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/types/pagination';

const tabClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'border-foreground text-foreground'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  );

// Confirmed bills, drafts and possible duplicates are separate lists with their own paging, so
// each tab is its own route rather than a filter on one list.
export function BillsTabs(): ReactElement {
  const { t } = useTranslation('bills');
  // Same key as the drafts tab's first page, so the count shares its cache.
  const drafts = useDraftBills(DEFAULT_PAGE, DEFAULT_LIMIT);
  const total = drafts.data?.meta.total;
  // Same key as the clean-up page without a range, so they share the cache.
  const duplicates = useDuplicateSuggestions(EMPTY_DUPLICATE_RANGE);
  const pairs = duplicates.data?.pairs.length;
  // The endpoint returns at most 100 pairs.
  const pairsLabel = pairs != null && pairs >= 100 ? '100+' : pairs;
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
      <NavLink to="/bills/duplicates" className={tabClass}>
        {pairsLabel != null
          ? t('duplicates.cleanup.tabCount', { count: pairsLabel })
          : t('duplicates.cleanup.tab')}
      </NavLink>
    </nav>
  );
}
