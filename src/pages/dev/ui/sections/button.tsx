import type { ReactElement } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const id = 'button';
export const title = 'Button';
export const order = 10;

const VARIANTS = [
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
] as const;

export function Section(): ReactElement {
  return (
    <div className="space-y-3">
      {VARIANTS.map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-2">
          <Button variant={variant}>{variant}</Button>
          <Button variant={variant} size="sm">
            sm
          </Button>
          <Button variant={variant} size="lg">
            lg
          </Button>
          <Button variant={variant} size="icon" aria-label={`${variant} icon`}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant={variant} disabled>
            disabled
          </Button>
        </div>
      ))}
    </div>
  );
}
