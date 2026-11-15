import type { ReactElement } from 'react';
import { Input } from '@/components/ui/input';

export const id = 'input';
export const title = 'Input';
export const order = 20;

export function Section(): ReactElement {
  return (
    <div className="grid gap-2">
      <Input aria-label="Default" defaultValue="Text" />
      <Input aria-label="Placeholder" placeholder="Placeholder" />
      <Input aria-label="Disabled" defaultValue="Disabled" disabled />
    </div>
  );
}
