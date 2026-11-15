import type { ReactElement } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

function Sample({
  density,
}: {
  density?: 'default' | 'compact';
}): ReactElement {
  return (
    <Table density={density} containerClassName="bg-card">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead numeric>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Milk</TableCell>
          <TableCell numeric>1.20</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

describe('Table', () => {
  it('renders a scrollable bordered container', () => {
    const { container } = render(<Sample />);
    expect(container.firstChild).toHaveClass(
      'overflow-x-auto',
      'rounded-md',
      'border',
      'bg-card'
    );
    expect(screen.getByRole('table')).toHaveClass('w-full', 'text-sm');
  });

  it('cells use default density', () => {
    render(<Sample />);
    expect(screen.getByRole('cell', { name: 'Milk' })).toHaveClass(
      'px-3',
      'py-2'
    );
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveClass(
      'px-3',
      'py-2',
      'font-medium'
    );
  });

  it('compact density reaches cells', () => {
    render(<Sample density="compact" />);
    const cell = screen.getByRole('cell', { name: 'Milk' });
    expect(cell).toHaveClass('px-2');
    expect(cell).not.toHaveClass('px-3');
  });

  it('numeric aligns right with tabular figures', () => {
    render(<Sample />);
    expect(screen.getByRole('cell', { name: '1.20' })).toHaveClass(
      'text-right',
      'tabular-nums'
    );
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toHaveClass(
      'text-right',
      'tabular-nums'
    );
  });

  it('className wins over base', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-bold">H</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="px-4">C</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    const head = screen.getByRole('columnheader', { name: 'H' });
    expect(head).toHaveClass('font-bold');
    expect(head).not.toHaveClass('font-medium');
    const cell = screen.getByRole('cell', { name: 'C' });
    expect(cell).toHaveClass('px-4');
    expect(cell).not.toHaveClass('px-3');
  });

  it('cells work outside Table', () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCell>x</TableCell>
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByRole('cell', { name: 'x' })).toHaveClass('px-3');
  });

  it('renders footer and caption', () => {
    render(
      <Table>
        <TableCaption>Totals</TableCaption>
        <TableBody>
          <TableRow>
            <TableCell>a</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>sum</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );
    const table = screen.getByRole('table', { name: 'Totals' });
    expect(table.querySelector('tfoot')).toHaveClass('border-t', 'bg-muted/30');
  });
});
