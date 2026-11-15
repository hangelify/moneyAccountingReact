import * as React from 'react';
import { cn } from '@/lib/utils';

export type TableDensity = 'default' | 'compact';

// Cells read the density from the nearest Table; outside one they get the default.
const DensityContext = React.createContext<TableDensity>('default');

const densityClass: Record<TableDensity, string> = {
  default: 'px-3 py-2',
  compact: 'px-2 py-2',
};

const numericClass = 'text-right tabular-nums';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  density?: TableDensity;
  // Classes for the scroll container around the table.
  containerClassName?: string;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, density = 'default', ...props }, ref) => (
    <DensityContext.Provider value={density}>
      <div
        className={cn('overflow-x-auto rounded-md border', containerClassName)}
      >
        <table
          ref={ref}
          className={cn('w-full text-sm', className)}
          {...props}
        />
      </div>
    </DensityContext.Provider>
  )
);
Table.displayName = 'Table';

// The border sits on <thead>, not on its row: rows drop their last border.
const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('border-b bg-muted/50 text-left', className)}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={className} {...props} />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('border-t bg-muted/30 font-medium', className)}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn('border-b last:border-b-0', className)}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  // Right-aligned, tabular figures: for amounts and counts.
  numeric?: boolean;
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, numeric, ...props }, ref) => {
    const density = React.useContext(DensityContext);
    return (
      <th
        ref={ref}
        className={cn(
          'font-medium',
          densityClass[density],
          numeric && numericClass,
          className
        )}
        {...props}
      />
    );
  }
);
TableHead.displayName = 'TableHead';

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, numeric, ...props }, ref) => {
    const density = React.useContext(DensityContext);
    return (
      <td
        ref={ref}
        className={cn(
          densityClass[density],
          numeric && numericClass,
          className
        )}
        {...props}
      />
    );
  }
);
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn(
      'mt-2 caption-bottom text-sm text-muted-foreground',
      className
    )}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
};
