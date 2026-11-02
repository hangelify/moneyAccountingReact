import { useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { ApiError } from '@/auth/apiError';
import { LoadingFallback } from '@/components/common/LoadingFallback';
import { CurrencySelect } from '@/components/currency/CurrencySelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useHouseholds } from '@/contexts/HouseholdContext';
import { toast } from '@/hooks/use-toast';
import { useUpdateHousehold } from '@/hooks/useUpdateHousehold';
import {
  householdSettingsSchema,
  type HouseholdSettingsFormData,
} from '@/lib/validation-schemas';
import type { Household } from '@/types/households';
import { changedFields } from './changedFields';

export function HouseholdSettings(): ReactElement {
  const { t } = useTranslation('households');
  const { status, activeHousehold, refetch } = useHouseholds();

  let body: ReactElement;
  if (status === 'idle' || status === 'loading') return <LoadingFallback />;
  if (!activeHousehold) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">{t('loadFailed')}</p>
        <Button type="button" variant="outline" onClick={() => void refetch()}>
          {t('retry')}
        </Button>
      </div>
    );
  } else {
    // A new household starts a fresh form.
    body = (
      <SettingsForm key={activeHousehold.id} household={activeHousehold} />
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {t('settings.title')}
        </h1>
        {body}
      </div>
    </div>
  );
}

function SettingsForm({ household }: { household: Household }): ReactElement {
  const { t } = useTranslation('households');
  const mutation = useUpdateHousehold(household.id);
  // A member, or a 403 when the API does not send the role yet.
  const [forbidden, setForbidden] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<HouseholdSettingsFormData>({
    resolver: zodResolver(householdSettingsSchema),
    defaultValues: { name: household.name, currency: household.currency },
  });
  const changes = changedFields(household, form.watch());
  const unchanged = Object.keys(changes).length === 0;

  if (household.role === 'member' || forbidden) {
    return (
      <div className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">{t('settings.name')}</dt>
            <dd>{household.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('settings.currency')}</dt>
            <dd>{household.currency}</dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          {t('settings.ownerOnly')}
        </p>
      </div>
    );
  }

  const onSubmit = async (values: HouseholdSettingsFormData): Promise<void> => {
    const body = changedFields(household, values);
    if (Object.keys(body).length === 0) return;
    setFormError(null);
    try {
      await mutation.mutateAsync(body);
      form.reset(values);
      toast({ variant: 'success', title: t('settings.saved') });
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setForbidden(true);
      } else if (error instanceof ApiError && error.status === 400) {
        // The form validates before sending, so a 400 is a bug.
        console.error('household update rejected', body, error);
        setFormError(t('settings.invalid'));
      } else {
        toast({ variant: 'destructive', title: t('settings.failed') });
      }
    }
  };

  return (
    <Form
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4 rounded-lg border bg-card p-4 sm:p-6"
    >
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('settings.name')}</FormLabel>
            <FormControl>
              <Input disabled={mutation.isPending} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="currency"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('settings.currency')}</FormLabel>
            <FormControl>
              <CurrencySelect
                required
                value={field.value}
                onChange={(c) => field.onChange(c ?? '')}
                disabled={mutation.isPending}
              />
            </FormControl>
            <p className="text-sm text-muted-foreground">
              {t('settings.currencyHint')}
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}
      <Button
        type="submit"
        className="w-full"
        disabled={unchanged || mutation.isPending}
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('settings.saving')}
          </>
        ) : (
          t('settings.save')
        )}
      </Button>
    </Form>
  );
}
