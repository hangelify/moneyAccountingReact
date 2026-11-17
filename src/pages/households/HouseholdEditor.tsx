import { useState, type ReactElement } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { ApiError } from '@/auth/apiError';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { toast } from '@/components/ui/use-toast';
import { useUpdateHousehold } from '@/hooks/useUpdateHousehold';
import {
  householdSettingsSchema,
  type HouseholdSettingsFormData,
} from '@/lib/validation-schemas';
import type { Household } from '@/types/households';
import { changedFields } from './changedFields';
import { CurrencyField } from './CurrencyField';
import { DeleteHouseholdButton } from './DeleteHouseholdButton';
import { NameField } from './NameField';
import { OwnNameForm } from './OwnNameForm';

export function HouseholdEditor({
  household,
}: {
  household: Household;
}): ReactElement {
  return (
    <div className="space-y-4 border-t pt-4">
      <MainFields household={household} />
      <OwnNameForm household={household} />
      {household.role === 'owner' && (
        <DeleteHouseholdButton household={household} />
      )}
    </div>
  );
}

function MainFields({ household }: { household: Household }): ReactElement {
  const { t } = useTranslation('households');
  // A member, or a 403 when the API does not send the role yet.
  const [forbidden, setForbidden] = useState(false);

  if (household.role === 'member' || forbidden) {
    return (
      <div className="space-y-2">
        <p className="text-sm">
          {household.original_name} · {household.currency}
        </p>
        <p className="text-sm text-muted-foreground">{t('editor.ownerOnly')}</p>
      </div>
    );
  }
  return (
    <OwnerFields household={household} onForbidden={() => setForbidden(true)} />
  );
}

function OwnerFields({
  household,
  onForbidden,
}: {
  household: Household;
  onForbidden: () => void;
}): ReactElement {
  const { t } = useTranslation('households');
  const mutation = useUpdateHousehold(household.id);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<HouseholdSettingsFormData>({
    resolver: zodResolver(householdSettingsSchema),
    defaultValues: {
      name: household.original_name,
      currency: household.currency,
    },
  });
  const values = useWatch({ control: form.control });
  const unchanged =
    Object.keys(
      changedFields(household, {
        name: values.name ?? '',
        currency: values.currency ?? '',
      })
    ).length === 0;

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
        onForbidden();
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
      className="space-y-3"
    >
      <NameField
        control={form.control}
        name="name"
        label={t('settings.name')}
        disabled={mutation.isPending}
      />
      <CurrencyField
        control={form.control}
        name="currency"
        disabled={mutation.isPending}
        hint={t('settings.currencyHint')}
      />
      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}
      <SaveButton disabled={unchanged} pending={mutation.isPending} />
    </Form>
  );
}

function SaveButton({
  disabled,
  pending,
}: {
  disabled: boolean;
  pending: boolean;
}): ReactElement {
  const { t } = useTranslation('households');
  return (
    <Button type="submit" size="sm" disabled={disabled || pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('settings.saving')}
        </>
      ) : (
        t('settings.save')
      )}
    </Button>
  );
}
