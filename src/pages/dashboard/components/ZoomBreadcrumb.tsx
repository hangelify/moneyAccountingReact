import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { swatchStyle, type SegmentLook } from './segmentStyle';

export interface ZoomBreadcrumbProps {
  name: string;
  look: SegmentLook;
  onBack: () => void;
}

/** "← All categories › Food", shown while the chart is zoomed in. */
export function ZoomBreadcrumb({
  name,
  look,
  onBack,
}: ZoomBreadcrumbProps): ReactElement {
  const { t } = useTranslation('dashboard');
  return (
    <nav
      aria-label={t('breadcrumb')}
      className="flex min-w-0 items-center gap-1"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="-ml-2 shrink-0"
        onClick={onBack}
      >
        <ArrowLeft aria-hidden />
        {t('allCategories')}
      </Button>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <span
        aria-current="page"
        className="flex min-w-0 items-center gap-2 text-sm font-medium"
      >
        <span
          className="h-3 w-3 shrink-0 rounded-sm"
          style={swatchStyle(look)}
          aria-hidden
        />
        <span className="truncate">{name}</span>
      </span>
    </nav>
  );
}
