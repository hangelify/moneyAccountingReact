import type { ReactElement } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

interface NameFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  disabled?: boolean;
}

/** A text input bound to a react-hook-form field, with label and error. */
export function NameField<T extends FieldValues>({
  control,
  name,
  label,
  disabled = false,
}: NameFieldProps<T>): ReactElement {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input disabled={disabled} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
