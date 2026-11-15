import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { OverlayNote } from '../OverlayNote';

export const id = 'toast';
export const title = 'Toast';
export const order = 90;

const VARIANTS = ['default', 'destructive', 'success', 'warning'] as const;

export function Section(): ReactElement {
  return (
    <>
      <OverlayNote />
      <div className="flex flex-wrap gap-2">
        {VARIANTS.map((variant) => (
          <Button
            key={variant}
            variant="outline"
            onClick={() => {
              toast({
                variant,
                title: `${variant} toast`,
                description: 'Toast description text.',
              });
            }}
          >
            {variant}
          </Button>
        ))}
      </div>
    </>
  );
}
