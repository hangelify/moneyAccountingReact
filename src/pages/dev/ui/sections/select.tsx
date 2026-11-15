import type { ReactElement } from 'react';
import { Select } from '@/components/ui/select';

export const id = 'select';
export const title = 'Select';
export const order = 25;

// No ids: each section renders twice (light and dark column).
export function Section(): ReactElement {
  return (
    <div className="grid gap-2">
      <Select aria-label="Default" defaultValue="piece">
        <option value="piece">piece</option>
        <option value="kg">kg</option>
        <option value="l">l</option>
      </Select>
      <Select aria-label="Grouped" defaultValue="EUR">
        <optgroup label="Europe">
          <option value="EUR">EUR</option>
          <option value="RSD">RSD</option>
        </optgroup>
        <optgroup label="Americas">
          <option value="USD">USD</option>
        </optgroup>
      </Select>
      <Select aria-label="Disabled" disabled>
        <option>Disabled</option>
      </Select>
      <Select aria-label="Invalid" aria-invalid="true">
        <option>Invalid</option>
      </Select>
    </div>
  );
}
