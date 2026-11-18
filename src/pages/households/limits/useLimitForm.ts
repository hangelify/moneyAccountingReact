import { useRef, useState, type BaseSyntheticEvent } from 'react';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/auth/apiError';
import { toast } from '@/components/ui/use-toast';
import {
  useRefreshCategoryLimits,
  useSaveCategoryLimit,
} from '@/hooks/useCategoryLimits';
import type { LimitPeriodType } from '@/lib/limitPeriods';
import {
  categoryLimitSchema,
  type CategoryLimitFormData,
  type CategoryLimitFormInput,
} from '@/lib/validation-schemas';
import type { CategoryLimit } from '@/types/categoryLimits';

export type LimitFormApi = UseFormReturn<
  CategoryLimitFormInput,
  unknown,
  CategoryLimitFormData
>;

interface UseLimitFormResult {
  form: LimitFormApi;
  submit: (e?: BaseSyntheticEvent) => Promise<void>;
  periodType: LimitPeriodType;
  pending: boolean;
  /** Save is off: an open limit without changes. */
  unchanged: boolean;
  /** The server answered 409; the list was refreshed. */
  conflict: boolean;
}

/** State and saving of one category's inline limit form. */
export function useLimitForm(
  hid: string,
  categoryId: string,
  current: CategoryLimit | null,
  onDone: (saved: boolean) => void
): UseLimitFormResult {
  const { t } = useTranslation('limits');
  const mutation = useSaveCategoryLimit(hid);
  const refresh = useRefreshCategoryLimits(hid);
  const [conflict, setConflict] = useState(false);
  // isPending re-renders a tick late: a fast double click would POST twice.
  const inFlight = useRef(false);
  const hasOpenLimit = current?.effective_to === null;

  const form = useForm<CategoryLimitFormInput, unknown, CategoryLimitFormData>({
    resolver: zodResolver(categoryLimitSchema),
    defaultValues: {
      amount: current ? String(current.amount) : '',
      period_type: current?.period_type ?? 'MONTHLY',
    },
  });
  const periodType = useWatch({ control: form.control, name: 'period_type' });

  const onError = (error: unknown): void => {
    const status = error instanceof ApiError ? error.status : undefined;
    if (status === 409) {
      setConflict(true);
      refresh(false);
    } else if (status === 404) {
      toast({ variant: 'destructive', title: t('errors.gone') });
      refresh(true);
      onDone(false);
    } else if (error instanceof ApiError && status === 400) {
      form.setError('amount', {
        message: error.messages[0] ?? t('errors.saveFailed'),
      });
    } else {
      toast({ variant: 'destructive', title: t('errors.saveFailed') });
    }
  };

  const save = async (values: CategoryLimitFormData): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setConflict(false);
    try {
      await mutation.mutateAsync({ categoryId, hasOpenLimit, body: values });
      onDone(true);
    } catch (error) {
      onError(error);
    } finally {
      inFlight.current = false;
    }
  };
  const submit = (e?: BaseSyntheticEvent): Promise<void> =>
    form.handleSubmit(save)(e);

  return {
    form,
    submit,
    periodType,
    pending: mutation.isPending,
    unchanged: hasOpenLimit && !form.formState.isDirty,
    conflict,
  };
}
