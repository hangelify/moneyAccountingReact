import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { OverlayNote } from '../OverlayNote';

export const id = 'tooltip';
export const title = 'Tooltip';
export const order = 80;

export function Section(): ReactElement {
  return (
    <TooltipProvider delayDuration={150}>
      <OverlayNote />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Hover me</Button>
        </TooltipTrigger>
        <TooltipContent>Tooltip text</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
