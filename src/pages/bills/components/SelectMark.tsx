import type { ReactElement } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The look of a checkbox on a card or row that is itself the checkbox. */
export function SelectMark({ checked }: { checked: boolean }): ReactElement {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-background'
      )}
    >
      {checked && <Check className="h-3 w-3" />}
    </span>
  );
}
