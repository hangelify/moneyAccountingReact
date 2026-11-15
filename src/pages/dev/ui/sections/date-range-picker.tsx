import { useState, type ReactElement } from 'react';
import { DateRangePicker } from '@/components/common/DateRangePicker';

export const id = 'date-range-picker';
export const title = 'DateRangePicker';
export const order = 40;

interface Range {
  from: string | null;
  to: string | null;
}

export function Section(): ReactElement {
  const [empty, setEmpty] = useState<Range>({ from: null, to: null });
  const [filled, setFilled] = useState<Range>({
    from: '2026-11-01',
    to: '2026-11-15',
  });
  const [invalid, setInvalid] = useState<Range>({
    from: '2026-11-15',
    to: '2026-11-01',
  });
  return (
    <div className="space-y-4">
      <DateRangePicker {...empty} onChange={setEmpty} />
      <DateRangePicker {...filled} onChange={setFilled} />
      <DateRangePicker {...invalid} onChange={setInvalid} />
    </div>
  );
}
