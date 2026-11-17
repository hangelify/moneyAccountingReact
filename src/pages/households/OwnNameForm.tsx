import type { ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { toast } from '@/components/ui/use-toast';
import { useUpdateMyHouseholdName } from '@/hooks/useHouseholdMutations';
import {
  ownHouseholdNameSchema,
  type OwnHouseholdNameFormData,
} from '@/lib/validation-schemas';
import type { Household } from '@/types/households';
import { NameField } from './NameField';

/** The caller's own name for a budget; empty/Reset falls back to the original. */
export function OwnNameForm({
  household,
}: {
  household: Household;
}): ReactElement {
  const { t } = useTranslation('households');
  const mutation = useUpdateMyHouseholdName(household.id);
  const hasOwnName = household.name !== household.original_name;
  const form = useForm<OwnHouseholdNameFormData>({
    resolver: zodResolver(ownHouseholdNameSchema),
    defaultValues: { display_name: hasOwnName ? household.name : '' },
  });

  const send = async (display_name: string | null): Promise<void> => {
    try {
      await mutation.mutateAsync({ display_name });
      form.reset({ display_name: display_name ?? '' });
      toast({ variant: 'success', title: t('editor.ownNameSaved') });
    } catch {
      toast({ variant: 'destructive', title: t('editor.ownNameFailed') });
    }
  };

  return (
    <Form
      form={form}
      onSubmit={form.handleSubmit((v) => send(v.display_name.trim()))}
      className="space-y-3"
    >
      <NameField
        control={form.control}
        name="display_name"
        label={t('editor.ownName')}
        disabled={mutation.isPending}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {t('editor.ownNameSave')}
        </Button>
        {hasOwnName && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => void send(null)}
          >
            {t('editor.ownNameReset')}
          </Button>
        )}
      </div>
    </Form>
  );
}
