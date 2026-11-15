import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { OverlayNote } from '../OverlayNote';

export const id = 'sheet';
export const title = 'Sheet';
export const order = 60;

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

export function Section(): ReactElement {
  return (
    <>
      <OverlayNote />
      <div className="flex flex-wrap gap-2">
        {SIDES.map((side) => (
          <Sheet key={side}>
            <SheetTrigger asChild>
              <Button variant="outline">{side}</Button>
            </SheetTrigger>
            <SheetContent side={side}>
              <SheetHeader>
                <SheetTitle>Sheet from {side}</SheetTitle>
                <SheetDescription>Sheet content goes here.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        ))}
      </div>
    </>
  );
}
