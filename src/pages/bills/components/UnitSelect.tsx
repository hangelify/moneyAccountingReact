import type { ReactElement } from 'react';
import { Select } from '@/components/ui/select';
import type { BillEditItem } from '@/types/bills';

type Unit = BillEditItem['unit'];

const UNITS: Unit[] = ['', 'kg', 'g', 'l', 'ml', 'piece'];

interface UnitSelectProps {
  value: Unit;
  onChange: (unit: Unit) => void;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

/** Unit of a bill item; the empty unit shows as a dash. */
export function UnitSelect({
  value,
  onChange,
  ...props
}: UnitSelectProps): ReactElement {
  return (
    <Select
      {...props}
      value={value}
      onChange={(e) => onChange(e.target.value as Unit)}
    >
      {UNITS.map((u) => (
        <option key={u} value={u}>
          {u || '—'}
        </option>
      ))}
    </Select>
  );
}
