import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubCategories } from '@/hooks/useSubCategories';
import { toSubCategoryRef } from '@/types/categories';
import type { CategoryRef, SubCategoryRef } from '@/types/bills';

interface SubCategorySelectProps {
  value: SubCategoryRef | null;
  // The line's own category; shown when it has no sub-category.
  category?: CategoryRef | null;
  // The category is the picked sub-category's, or null when cleared.
  onChange: (next: SubCategoryRef | null, category: CategoryRef | null) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string | undefined;
}

export function SubCategorySelect({
  value,
  category,
  onChange,
  disabled,
  id,
  'aria-label': ariaLabel,
}: SubCategorySelectProps): ReactElement {
  const { t } = useTranslation('bills');
  const { status, groups, byId, refetch } = useSubCategories();

  const isLoading = status === 'pending';
  const isError = status === 'error';

  // When the saved value's id isn't (yet) in the loaded set — either because
  // we're still fetching or because the server no longer returns it — render
  // a transient <option> so the controlled <select> stays in sync and the
  // user sees the existing label instead of a blank.
  const showTransient = value !== null && !byId.has(value.id);
  // A line with a category but no sub-category: nothing in the list matches,
  // so it gets its own option, keyed apart from sub-category ids.
  const categoryOnly = value === null && category ? category : null;
  const categoryOnlyValue = categoryOnly ? `category:${categoryOnly.id}` : '';

  const handleChange = (next: string): void => {
    if (next === '') {
      onChange(null, null);
      return;
    }
    const sc = byId.get(next);
    if (!sc) return;
    onChange(toSubCategoryRef(sc), {
      id: sc.category_id,
      name: sc.category_name,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        id={id}
        aria-label={ariaLabel}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        value={value?.id ?? categoryOnlyValue}
        disabled={disabled === true || isLoading || isError}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">
          {isLoading
            ? t('review.items.subCategoryLoading')
            : isError
              ? t('review.items.subCategoryError')
              : t('review.items.subCategoryPlaceholder')}
        </option>
        {categoryOnly && (
          <option value={categoryOnlyValue}>{categoryOnly.name}</option>
        )}
        {showTransient && value && (
          <option value={value.id}>
            {value.category_name} › {value.name}
          </option>
        )}
        {groups.map((group) => (
          <optgroup key={group.categoryName} label={group.categoryName}>
            {group.items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {isError && (
        <button
          type="button"
          className="text-sm text-primary underline"
          onClick={refetch}
        >
          {t('review.items.subCategoryRetry')}
        </button>
      )}
    </div>
  );
}
