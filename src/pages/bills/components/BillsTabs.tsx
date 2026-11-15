import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { SegmentedNav } from '@/components/ui/segmented-tabs';
import { useDraftBills } from '@/hooks/useDraftBills';
import {
  EMPTY_DUPLICATE_RANGE,
  useDuplicateSuggestions,
} from '@/hooks/useDuplicateSuggestions';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '@/types/pagination';

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
    <SegmentedNav
      variant="underline"
      aria-label={t('tabs.label')}
      items={[
        { to: '/bills', end: true, label: t('tabs.confirmed') },
        {
          to: '/bills/drafts',
          label:
            total != null
              ? t('tabs.draftsCount', { count: total })
              : t('tabs.drafts'),
        },
        {
          to: '/bills/duplicates',
          label:
            pairsLabel != null
              ? t('duplicates.cleanup.tabCount', { count: pairsLabel })
              : t('duplicates.cleanup.tab'),
        },
      ]}
    />
  );
}
