import { useState } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useCategoryTree } from '@/hooks/useCategoryTree';
import { filterTree } from '@/hooks/categoryTree';
import { formatLineCategory } from '@/pages/bills/lineCategory';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { CategoryRef, SubCategoryRef } from '@/types/bills';

export interface CategoryValue {
  category: CategoryRef | null;
  sub_category: SubCategoryRef | null;
}

interface CategoryPickerProps {
  value: CategoryValue;
  onChange: (next: CategoryValue) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string | undefined;
}

const NONE = 'none';

// The row a value sits on. A sub-category wins, so an old line without its
// category still has its row checked.
function rowKey(value: CategoryValue): string {
  if (value.sub_category) return `s:${value.sub_category.id}`;
  if (value.category) return `c:${value.category.id}`;
  return NONE;
}

/**
 * Picks a line's category: a whole category, or one of its sub-categories.
 * The trigger shows the line's own value, so one no longer in the list (a
 * deleted category) still reads right.
 */
export function CategoryPicker({
  value,
  onChange,
  disabled,
  id,
  'aria-label': ariaLabel,
}: CategoryPickerProps): ReactElement {
  const { t } = useTranslation('bills');
  const { status, tree, refetch } = useCategoryTree();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const current = rowKey(value);
  const label = formatLineCategory(value);
  const visible = filterTree(tree, query);

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    if (!next) setQuery('');
  };

  const pick = (next: CategoryValue): void => {
    onChange(next);
    handleOpenChange(false);
  };

  const row = (
    key: string,
    text: string,
    indent: boolean,
    next: CategoryValue
  ): ReactElement => (
    <CommandItem
      key={key}
      value={key}
      data-current={key === current ? 'true' : undefined}
      className={indent ? 'pl-6' : 'font-semibold'}
      onSelect={() => pick(next)}
    >
      <span className="flex-1 truncate">{text}</span>
      <Check
        aria-hidden
        className={cn('h-4 w-4', key === current ? 'opacity-100' : 'opacity-0')}
      />
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          disabled={disabled === true || status === 'pending'}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-2 py-1 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="truncate">
            {status === 'pending' && !label
              ? t('review.items.categoryLoading')
              : (label ?? t('review.items.categoryPlaceholder'))}
          </span>
          <ChevronsUpDown aria-hidden className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        inline
        className="w-[var(--radix-popover-trigger-width)] min-w-64"
      >
        <Command shouldFilter={false} defaultValue={current}>
          <CommandInput
            aria-label={t('review.items.categorySearch')}
            placeholder={t('review.items.categorySearch')}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {status === 'error' ? (
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
                <span>{t('review.items.categoryError')}</span>
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={refetch}
                >
                  {t('review.items.categoryRetry')}
                </button>
              </div>
            ) : (
              <>
                <CommandEmpty>{t('review.items.categoryEmpty')}</CommandEmpty>
                {!query.trim() &&
                  row(NONE, t('review.items.categoryNone'), false, {
                    category: null,
                    sub_category: null,
                  })}
                {visible.flatMap((node) => {
                  const category = { id: node.id, name: node.name };
                  return [
                    row(`c:${node.id}`, node.name, false, {
                      category,
                      sub_category: null,
                    }),
                    ...node.subs.map((sub) =>
                      row(`s:${sub.id}`, sub.name, true, {
                        category,
                        sub_category: {
                          id: sub.id,
                          name: sub.name,
                          category_name: node.name,
                        },
                      })
                    ),
                  ];
                })}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
