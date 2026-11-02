import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { PaginationMeta } from '@/types/pagination';

export interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (next: number) => void;
}

export function Pagination({
  meta,
  onPageChange,
}: PaginationProps): ReactElement | null {
  const { t } = useTranslation('bills');
  if (meta.total_pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 py-3">
      <Button
        variant="outline"
        size="sm"
        disabled={meta.page <= 1}
        onClick={() => onPageChange(meta.page - 1)}
        aria-label={t('confirmed.pagination.prev')}
      >
        {t('confirmed.pagination.prev')}
      </Button>
      <span className="text-sm text-muted-foreground">
        {t('confirmed.pagination.pageOf', {
          page: meta.page,
          total: meta.total_pages,
        })}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={meta.page >= meta.total_pages}
        onClick={() => onPageChange(meta.page + 1)}
        aria-label={t('confirmed.pagination.next')}
      >
        {t('confirmed.pagination.next')}
      </Button>
    </div>
  );
}
