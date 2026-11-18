import type { KeyboardEvent, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  LIMIT_PERIOD_TYPES,
  todayUtcIsoDate,
  type LimitPeriodType,
} from '@/lib/limitPeriods';
import type { CategoryLimit } from '@/types/categoryLimits';
import { SaveButton } from '../SaveButton';
import { formatPeriod, limitHint, type LimitHint } from './limitHint';
import { useLimitForm, type LimitFormApi } from './useLimitForm';

interface LimitFormProps {
  hid: string;
  categoryId: string;
  categoryName: string;
  current: CategoryLimit | null;
  currency: string;
  /** `true` after a save, `false` on cancel or when the limit is gone. */
  onDone: (saved: boolean) => void;
}

/** Inline form of one category's limit, with what saving would change. */
export function LimitForm({
  hid,
  categoryId,
  categoryName,
  current,
  currency,
  onDone,
}: LimitFormProps): ReactElement {
  const { t, i18n } = useTranslation('limits');
  const { form, submit, periodType, pending, unchanged, conflict } =
    useLimitForm(hid, categoryId, current, onDone);
  const hint = limitHint(periodType, current, todayUtcIsoDate());

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') onDone(false);
  };

  return (
    <div onKeyDown={onKeyDown}>
      <Form form={form} onSubmit={submit} className="space-y-2">
        <div className="flex flex-wrap items-start gap-2">
          <AmountField
            form={form}
            currency={currency}
            categoryName={categoryName}
            disabled={pending}
          />
          <PeriodField form={form} disabled={pending} />
          <SaveButton disabled={unchanged} pending={pending}>
            {t('form.save')}
          </SaveButton>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onDone(false);
            }}
          >
            {t('form.cancel')}
          </Button>
        </div>
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {hintText(hint, periodType, t, i18n.language)}
        </p>
        {conflict && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {t('errors.exists')}
          </p>
        )}
      </Form>
    </div>
  );
}

function AmountField({
  form,
  currency,
  categoryName,
  disabled,
}: {
  form: LimitFormApi;
  currency: string;
  categoryName: string;
  disabled: boolean;
}): ReactElement {
  const { t } = useTranslation('limits');
  return (
    <FormField
      control={form.control}
      name="amount"
      render={({ field }) => (
        <FormItem className="w-40">
          <FormLabel className="sr-only">{t('form.amount')}</FormLabel>
          <div className="flex items-center gap-1">
            <FormControl>
              <Input
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                aria-description={categoryName}
                disabled={disabled}
                {...field}
              />
            </FormControl>
            <span className="text-sm text-muted-foreground">{currency}</span>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function PeriodField({
  form,
  disabled,
}: {
  form: LimitFormApi;
  disabled: boolean;
}): ReactElement {
  const { t } = useTranslation('limits');
  return (
    <FormField
      control={form.control}
      name="period_type"
      render={({ field }) => (
        <FormItem className="w-36">
          <FormLabel className="sr-only">{t('form.period')}</FormLabel>
          <FormControl>
            <Select disabled={disabled} {...field}>
              {LIMIT_PERIOD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`period.${type}`)}
                </option>
              ))}
            </Select>
          </FormControl>
        </FormItem>
      )}
    />
  );
}

/** "first", "first and second", or "first to last". */
function joinPeriods(labels: string[], t: TFunction<'limits'>): string {
  const first = labels[0] ?? '';
  const last = labels[labels.length - 1] ?? '';
  if (labels.length <= 1) return first;
  if (labels.length === 2) return t('hint.two', { first, second: last });
  return t('hint.range', { first, last });
}

/** "Applies from Q4 2026. …" plus the periods left without a limit. */
function hintText(
  hint: LimitHint,
  newType: LimitPeriodType,
  t: TFunction<'limits'>,
  lang: string
): string {
  const from = t('hint.from', {
    period: formatPeriod(newType, hint.start, lang),
  });
  if (hint.lostPeriods === null) return from;
  const { type, starts } = hint.lostPeriods;
  const periods = joinPeriods(
    starts.map((s) => formatPeriod(type, s, lang)),
    t
  );
  const lost = t(`hint.lost_${type}`, { periods });
  return `${from} ${lost}`;
}
