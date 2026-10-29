import type { ReactElement } from 'react';

interface SubCategoryLike {
  name: string;
  category_name: string;
}

interface SubCategoryLabelProps {
  subCategory: SubCategoryLike | null;
  className?: string;
}

export function SubCategoryLabel({
  subCategory,
  className,
}: SubCategoryLabelProps): ReactElement {
  if (!subCategory) return <span className={className}>—</span>;
  return (
    <span className={className}>
      {subCategory.category_name} <span aria-hidden>›</span> {subCategory.name}
    </span>
  );
}
