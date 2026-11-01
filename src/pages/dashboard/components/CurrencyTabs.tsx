import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

export interface CurrencyTabsProps {
  tabs: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}

/** One tab per currency view; hidden when there is only one. */
export function CurrencyTabs({
  tabs,
  selected,
  onSelect,
}: CurrencyTabsProps): ReactElement | null {
  if (tabs.length < 2) return null;
  return (
    <div
      role="tablist"
      className="inline-flex w-fit gap-1 rounded-lg bg-muted p-1"
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === selected}
          className={cn(
            'rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors',
            tab.key === selected && 'bg-background text-foreground shadow-sm'
          )}
          onClick={() => onSelect(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
