import type { ReactElement } from 'react';
import { BillCard, type BillCardBill } from './BillCard';

export interface BillCardGridProps {
  bills: BillCardBill[];
  onCardClick: (id: string) => void;
}

export function BillCardGrid({
  bills,
  onCardClick,
}: BillCardGridProps): ReactElement {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {bills.map((b) => (
        <li key={b.id}>
          <BillCard bill={b} onClick={onCardClick} />
        </li>
      ))}
    </ul>
  );
}
