import { useState, type ReactElement } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { householdErrorReason } from '@/auth/householdErrorReason';
import { CurrencySelect } from '@/components/currency/CurrencySelect';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/components/ui/use-toast';
import { useHouseholds } from '@/contexts/HouseholdContext';
import { useCreateHousehold } from '@/hooks/useHouseholdMutations';
import {
  createHouseholdSchema,
  type CreateHouseholdFormData,
} from '@/lib/validation-schemas';

interface CreateHouseholdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCurrency: string;
}

export function CreateHouseholdDialog({
  open,
  onOpenChange,
  defaultCurrency,
}: CreateHouseholdDialogProps): ReactElement {
  const { t } = useTranslation('households');
  const { setActiveHouseholdId } = useHouseholds();
  const mutation = useCreateHousehold();
  const [limitReached, setLimitReached] = useState(false);

  const form = useForm<CreateHouseholdFormData>({
    resolver: zodResolver(createHouseholdSchema),
    defaultValues: { name: '', currency: defaultCurrency },
  });

  const onSubmit = async (values: CreateHouseholdFormData): Promise<void> => {
    setLimitReached(false);
    try {
      const saved = await mutation.mutateAsync(values);
      onOpenChange(false);
      form.reset({ name: '', currency: defaultCurrency });
      toast({
        variant: 'success',
        title: t('create.created'),
        action: (
          <ToastAction
            altText={t('create.switch')}
            onClick={() => setActiveHouseholdId(saved.id)}
          >
            {t('create.switch')}
          </ToastAction>
        ),
      });
    } catch (error) {
      if (householdErrorReason(error) === 'household_limit') {
        setLimitReached(true);
      } else {
        toast({ variant: 'destructive', title: t('create.failed') });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
        </DialogHeader>
        <Form
          form={form}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <CreateFields form={form} disabled={mutation.isPending} />
          {limitReached && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {t('create.limit')}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('create.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('create.creating')}
                </>
              ) : (
                t('create.submit')
              )}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CreateFields({
  form,
  disabled,
}: {
  form: UseFormReturn<CreateHouseholdFormData>;
  disabled: boolean;
}): ReactElement {
  const { t } = useTranslation('households');
  return (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('create.name')}</FormLabel>
            <FormControl>
              <Input
                autoFocus
                autoComplete="off"
                disabled={disabled}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="currency"
        render={({ field: f }) => (
          <FormItem>
            <FormLabel>{t('create.currency')}</FormLabel>
            <FormControl>
              <CurrencySelect
                aria-label={t('create.currency')}
                disabled={disabled}
                value={f.value}
                onChange={(c) => f.onChange(c ?? '')}
                required
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
