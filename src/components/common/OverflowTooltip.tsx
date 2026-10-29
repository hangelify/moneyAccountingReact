import { useRef, useState, type ReactElement } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { isControlOverflowing } from '@/lib/textOverflow';

interface OverflowTooltipProps {
  /** Full text to show; empty means no tooltip. */
  text: string;
  /** An input or select, or an element wrapping one. Must take a ref. */
  children: ReactElement;
}

/**
 * Shows `text` in a tooltip on hover or focus, but only while the wrapped
 * control is too narrow to show its text in full.
 */
export function OverflowTooltip({
  text,
  children,
}: OverflowTooltipProps): ReactElement {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <Tooltip
      open={open}
      onOpenChange={(next) =>
        setOpen(next && text !== '' && isControlOverflowing(triggerRef.current))
      }
    >
      <TooltipTrigger asChild ref={triggerRef}>
        {children}
      </TooltipTrigger>
      <TooltipContent className="max-w-sm break-words">{text}</TooltipContent>
    </Tooltip>
  );
}
