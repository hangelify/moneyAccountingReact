import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/ui/use-toast';
import { ApiError } from '@/auth/apiError';
import {
  useRefreshCategoryLimits,
  useRemoveCategoryLimit,
} from '@/hooks/useCategoryLimits';
import { limitPeriodEnd, todayUtcIsoDate } from '@/lib/limitPeriods';
import type { CategoryLimit } from '@/types/categoryLimits';
import { formatLongDate } from './formatDate';

/** Confirms removing a limit, which lives to the end of its period. */
export function RemoveLimitDialog({
  hid,
  name,
  limit,
  open,
  onOpenChange,
}: {
  hid: string;
  name: string;
  limit: CategoryLimit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactElement {
  const { t, i18n } = useTranslation('limits');
  const mutation = useRemoveCategoryLimit(hid);
  const refresh = useRefreshCategoryLimits(hid);
  const end = limitPeriodEnd(limit.period_type, todayUtcIsoDate());

  const onConfirm = async (): Promise<void> => {
    try {
      await mutation.mutateAsync(limit.category_id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        toast({ variant: 'destructive', title: t('errors.gone') });
        refresh(true);
      } else {
        toast({ variant: 'destructive', title: t('remove.failed') });
      }
    }
    onOpenChange(false);
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      variant="destructive"
      title={t('remove.title', { name })}
      description={t('remove.description', {
        date: formatLongDate(end, i18n.language),
      })}
      confirmLabel={t('remove.confirm')}
      onConfirm={onConfirm}
    />
  );
}
