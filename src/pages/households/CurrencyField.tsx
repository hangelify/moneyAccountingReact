import type { ReactElement } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CurrencySelect } from '@/components/currency/CurrencySelect';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

interface CurrencyFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  disabled?: boolean;
  hint?: string;
}

/** A required currency picker bound to a react-hook-form field. */
export function CurrencyField<T extends FieldValues>({
  control,
  name,
  disabled = false,
  hint,
}: CurrencyFieldProps<T>): ReactElement {
  const { t } = useTranslation('households');
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('settings.currency')}</FormLabel>
          <FormControl>
            <CurrencySelect
              required
              value={field.value}
              onChange={(c) => field.onChange(c ?? '')}
              disabled={disabled}
            />
          </FormControl>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
