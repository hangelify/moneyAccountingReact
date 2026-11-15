import type { ReactElement } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TableDensity } from '@/components/ui/table';

export const id = 'table';
export const title = 'Table';
export const order = 140;

const rows = [
  { name: 'Milk', count: 2, amount: '2.49' },
  { name: 'Apples', count: 1, amount: '4.71' },
  { name: 'Bread', count: 1, amount: '1.20' },
];

function Sample({ density }: { density: TableDensity }): ReactElement {
  return (
    <Table density={density}>
      <TableCaption>density=&quot;{density}&quot;</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead numeric>Count</TableHead>
          <TableHead numeric>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.name}>
            <TableCell>{r.name}</TableCell>
            <TableCell numeric>{r.count}</TableCell>
            <TableCell numeric>{r.amount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>Total</TableCell>
          <TableCell numeric>8.40</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

export function Section(): ReactElement {
  return (
    <div className="grid gap-4">
      <Sample density="default" />
      <Sample density="compact" />
    </div>
  );
}
