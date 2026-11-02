import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useMarkets } from '@/hooks/useMarkets';

export interface MarketMultiSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

export function MarketMultiSelect({
  value,
  onChange,
  disabled,
  id,
  'aria-label': ariaLabel,
}: MarketMultiSelectProps): ReactElement {
  const { t } = useTranslation('bills');
  const { data, isLoading, isError, refetch } = useMarkets();
  const [open, setOpen] = useState(false);

  const summary =
    value.length === 0
      ? t('confirmed.filters.marketsAll')
      : value.length <= 2
        ? value.join(', ')
        : t('confirmed.filters.marketsCount', { count: value.length });

  const toggle = (name: string): void => {
    onChange(
      value.includes(name) ? value.filter((n) => n !== name) : [...value, name]
    );
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className="w-full justify-between"
          disabled={disabled}
          aria-label={ariaLabel}
        >
          <span className="truncate">{summary}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] p-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground">
            {t('confirmed.filters.marketsLoading')}
          </p>
        )}
        {isError && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-destructive">
              {t('confirmed.filters.marketsError')}
            </span>
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-sm text-primary underline"
            >
              {t('confirmed.filters.retry')}
            </button>
          </div>
        )}
        {!isLoading && !isError && data && data.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t('confirmed.filters.marketsEmpty')}
          </p>
        )}
        {!isLoading && !isError && data && data.length > 0 && (
          <fieldset className="flex flex-col gap-1">
            <legend className="sr-only">{ariaLabel}</legend>
            {data.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={value.includes(m.name)}
                  onChange={() => toggle(m.name)}
                  aria-label={m.name}
                />
                <span>{m.name}</span>
                {m.city && (
                  <span className="text-muted-foreground">· {m.city}</span>
                )}
              </label>
            ))}
          </fieldset>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
