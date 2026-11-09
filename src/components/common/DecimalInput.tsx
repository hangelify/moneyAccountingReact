import { forwardRef, useId, useState } from 'react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isDecimalDraft, parseDecimal } from '@/lib/decimal';

export interface DecimalInputProps extends Omit<
  InputProps,
  'type' | 'value' | 'onChange' | 'inputMode'
> {
  value: number | null;
  onValueChange: (value: number | null) => void;
  // Shown under an empty field, which is then marked invalid.
  missingMessage?: string;
}

const format = (value: number | null): string =>
  value === null ? '' : String(value);

// A number field that keeps the text as typed, so it can be emptied and
// hold `12.` or `12,5` mid-entry; a native number input reports both as
// `''` or `12`. Empty text is null, never 0.
export const DecimalInput = forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ value, onValueChange, missingMessage, className, ...props }, ref) => {
    const [text, setText] = useState(() => format(value));
    const messageId = useId();
    // A value set from outside (a loaded bill, a cleared unit) replaces the
    // text; the user's own typing parses back to the same value and stays.
    if (parseDecimal(text) !== value) setText(format(value));
    const missing = missingMessage !== undefined && value === null;

    return (
      <>
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className={cn('aria-[invalid=true]:border-destructive', className)}
          value={text}
          onChange={(e) => {
            const next = e.target.value;
            if (!isDecimalDraft(next)) return;
            setText(next);
            onValueChange(parseDecimal(next));
          }}
          {...(missing
            ? { 'aria-invalid': true, 'aria-describedby': messageId }
            : {})}
          {...props}
        />
        {missing && (
          <p id={messageId} className="mt-1 text-xs text-destructive">
            {missingMessage}
          </p>
        )}
      </>
    );
  }
);
DecimalInput.displayName = 'DecimalInput';
