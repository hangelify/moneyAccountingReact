import type { ReactElement, ReactNode } from 'react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { BillDetailResponseDto } from '@/types/bills';
import { BillChart } from './BillChart';

type View = 'items' | 'chart';
const VIEWS: View[] = ['items', 'chart'];

export interface BillDetailViewsProps {
  bill: BillDetailResponseDto;
  // The chart shows saved data only, so it is off while editing.
  editing: boolean;
  // The Items view: the table or list the caller lays out.
  children: ReactNode;
}

// Items | Chart tabs over a bill's detail. Opens on Items; callers key it by
// bill id so every bill opens there.
export function BillDetailViews({
  bill,
  editing,
  children,
}: BillDetailViewsProps): ReactElement {
  const { t } = useTranslation('bills');
  const [view, setView] = useState<View>('items');
  const ids = useId();
  // Starting an edit leaves the chart, and Save or Cancel don't bring it back.
  if (editing && view !== 'items') setView('items');
  const shown = editing ? 'items' : view;

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={t('confirmed.detail.views.label')}
        className="inline-flex w-fit gap-1 rounded-lg bg-muted p-1"
      >
        {VIEWS.map((v) => (
          <button
            key={v}
            id={`${ids}-tab-${v}`}
            type="button"
            role="tab"
            aria-selected={v === shown}
            aria-controls={`${ids}-panel`}
            disabled={v === 'chart' && editing}
            className={cn(
              'rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors disabled:opacity-50',
              v === shown && 'bg-background text-foreground shadow-sm'
            )}
            onClick={() => setView(v)}
          >
            {t(`confirmed.detail.views.${v}`)}
          </button>
        ))}
      </div>
      <div
        id={`${ids}-panel`}
        role="tabpanel"
        aria-labelledby={`${ids}-tab-${shown}`}
      >
        {shown === 'chart' ? <BillChart bill={bill} /> : children}
      </div>
    </div>
  );
}
