import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export type SegmentedVariant = 'pill' | 'underline';

const listVariants = cva('', {
  variants: {
    variant: {
      pill: 'inline-flex w-fit gap-1 rounded-lg bg-muted p-1',
      underline: 'flex gap-1 border-b',
    },
  },
});

const itemVariants = cva(
  'text-sm font-medium transition-colors disabled:opacity-50',
  {
    variants: {
      variant: {
        pill: 'rounded-md px-3 py-1 text-muted-foreground',
        underline: '-mb-px border-b-2 px-3 py-2',
      },
      active: { true: '', false: '' },
    },
    compoundVariants: [
      {
        variant: 'pill',
        active: true,
        className: 'bg-background text-foreground shadow-sm',
      },
      {
        variant: 'underline',
        active: true,
        className: 'border-foreground text-foreground',
      },
      {
        variant: 'underline',
        active: false,
        className:
          'border-transparent text-muted-foreground hover:text-foreground',
      },
    ],
  }
);

export interface SegmentedTabItem<V extends string> {
  value: V;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedTabsProps<V extends string> {
  items: SegmentedTabItem<V>[];
  value: V;
  onValueChange: (value: V) => void;
  variant?: SegmentedVariant;
  'aria-label'?: string;
  // With it, tab ids are `${idPrefix}-tab-${value}` and every tab controls
  // `${idPrefix}-panel`, which the caller renders.
  idPrefix?: string;
  className?: string;
}

// Tabs inside a page (WAI-ARIA tabs): one tab stop, arrows and Home/End move
// and select, disabled tabs are skipped.
export function SegmentedTabs<V extends string>({
  items,
  value,
  onValueChange,
  variant = 'pill',
  'aria-label': ariaLabel,
  idPrefix,
  className,
}: SegmentedTabsProps<V>): React.ReactElement {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => !item.disabled)
    .map(({ i }) => i);
  const selected = items.findIndex((it) => it.value === value);
  // The tab stop: the selected tab, or the first enabled one when it can't take focus.
  const stop = enabled.includes(selected) ? selected : (enabled[0] ?? -1);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (enabled.length === 0) return;
    const pos = Math.max(enabled.indexOf(stop), 0);
    let next: number | undefined;
    if (e.key === 'ArrowRight') next = enabled[(pos + 1) % enabled.length];
    else if (e.key === 'ArrowLeft')
      next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    else return;
    e.preventDefault();
    if (next === undefined) return;
    refs.current[next]?.focus();
    const item = items[next];
    if (item && next !== stop) onValueChange(item.value);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(listVariants({ variant }), className)}
      onKeyDown={onKeyDown}
    >
      {items.map((item, i) => (
        <button
          key={item.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          id={idPrefix ? `${idPrefix}-tab-${item.value}` : undefined}
          type="button"
          role="tab"
          aria-selected={i === selected}
          aria-controls={idPrefix ? `${idPrefix}-panel` : undefined}
          tabIndex={i === stop ? 0 : -1}
          disabled={item.disabled}
          className={cn(itemVariants({ variant, active: i === selected }))}
          onClick={() => onValueChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export interface SegmentedNavItem {
  to: string;
  label: React.ReactNode;
  // Active only on this exact path, not on nested ones.
  end?: boolean;
}

export interface SegmentedNavProps {
  items: SegmentedNavItem[];
  variant?: SegmentedVariant;
  'aria-label'?: string;
  className?: string;
}

// Links between pages that look like tabs. A <nav>, not a tablist: links are
// reached with Tab, and NavLink sets aria-current on the current page.
export function SegmentedNav({
  items,
  variant = 'underline',
  'aria-label': ariaLabel,
  className,
}: SegmentedNavProps): React.ReactElement {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(listVariants({ variant }), className)}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(itemVariants({ variant, active: isActive }))
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
