import { useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { OverlayNote } from '../OverlayNote';

export const id = 'confirm-dialog';
export const title = 'ConfirmDialog';
export const order = 100;

const VARIANTS = ['default', 'destructive'] as const;

export function Section(): ReactElement {
  const [open, setOpen] = useState<(typeof VARIANTS)[number] | null>(null);
  return (
    <>
      <OverlayNote />
      <div className="flex flex-wrap gap-2">
        {VARIANTS.map((variant) => (
          <Button
            key={variant}
            variant="outline"
            onClick={() => {
              setOpen(variant);
            }}
          >
            {variant}
          </Button>
        ))}
      </div>
      <ConfirmDialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        title="Are you sure?"
        description="This is what the confirm dialog looks like."
        variant={open ?? 'default'}
        onConfirm={() => {
          setOpen(null);
        }}
      />
    </>
  );
}
