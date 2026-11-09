import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
    // Render in place rather than in a portal on <body>, so a popover opened
    // inside a dialog stays inside the dialog's focus trap.
    inline?: boolean;
  }
>(({ className, align = 'start', sideOffset = 4, inline, ...props }, ref) => {
  const content = (
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none',
        className
      )}
      {...props}
    />
  );
  return inline ? (
    content
  ) : (
    <PopoverPrimitive.Portal>{content}</PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
