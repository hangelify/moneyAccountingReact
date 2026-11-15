import { useState, type ReactElement } from 'react';
import { DecimalInput } from '@/components/common/DecimalInput';

export const id = 'decimal-input';
export const title = 'DecimalInput';
export const order = 30;

export function Section(): ReactElement {
  const [empty, setEmpty] = useState<number | null>(null);
  const [filled, setFilled] = useState<number | null>(12.5);
  return (
    <div className="grid gap-2">
      <DecimalInput
        aria-label="Empty"
        value={empty}
        onValueChange={setEmpty}
        missingMessage="Enter an amount"
      />
      <DecimalInput
        aria-label="Filled"
        value={filled}
        onValueChange={setFilled}
      />
    </div>
  );
}
