import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export interface SelectionBarProps {
  count: number;
  allState: boolean | 'mixed';
  onToggleAll: () => void;
  onMove: () => void;
  disabled: boolean;
}

/** Pinned to the bottom of the list while bills are being picked. */
export function SelectionBar({
  count,
  allState,
  onToggleAll,
  onMove,
  disabled,
}: SelectionBarProps): ReactElement {
  const { t } = useTranslation('bills');
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t bg-background px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={allState === true}
          indeterminate={allState === 'mixed'}
          onChange={onToggleAll}
          disabled={disabled}
        />
        {t('move.selectAll')}
      </label>
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {t('move.selected', { count })}
      </span>
      <Button
        className="ml-auto"
        size="sm"
        onClick={onMove}
        disabled={disabled || count === 0}
      >
        {t('move.moveSelected')}
      </Button>
    </div>
  );
}
