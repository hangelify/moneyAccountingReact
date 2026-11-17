import type { ReactElement } from 'react';
import type { BillSelectionView } from '../move/useBillSelection';
import { BillCard, type BillCardBill } from './BillCard';

export interface BillCardGridProps {
  bills: BillCardBill[];
  onCardClick: (id: string) => void;
  selection?: BillSelectionView | undefined;
}

export function BillCardGrid({
  bills,
  onCardClick,
  selection,
}: BillCardGridProps): ReactElement {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {bills.map((b) => (
        <li key={b.id}>
          <BillCard bill={b} onClick={onCardClick} selection={selection} />
        </li>
      ))}
    </ul>
  );
}
