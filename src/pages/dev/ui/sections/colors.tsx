import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

export const id = 'colors';
export const title = 'Colors';
export const order = 0;

// Class names are literal so Tailwind finds them in the source.
const SURFACES = [
  { name: 'background', swatch: 'bg-background text-foreground' },
  { name: 'card', swatch: 'bg-card text-card-foreground' },
  { name: 'popover', swatch: 'bg-popover text-popover-foreground' },
  { name: 'muted', swatch: 'bg-muted text-muted-foreground' },
  { name: 'primary', swatch: 'bg-primary text-primary-foreground' },
  { name: 'secondary', swatch: 'bg-secondary text-secondary-foreground' },
  { name: 'accent', swatch: 'bg-accent text-accent-foreground' },
  { name: 'foreground', swatch: 'bg-foreground text-background' },
];

const STATES = [
  {
    name: 'destructive',
    solid: 'bg-destructive text-destructive-foreground',
    soft: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  {
    name: 'success',
    solid: 'bg-success text-success-foreground',
    soft: 'border-success/40 bg-success/10 text-success',
  },
  {
    name: 'warning',
    solid: 'bg-warning text-warning-foreground',
    soft: 'border-warning/40 bg-warning/10 text-warning',
  },
  {
    name: 'info',
    solid: 'bg-info text-info-foreground',
    soft: 'border-info/40 bg-info/10 text-info',
  },
];

const LINES = [
  { name: 'border', swatch: 'bg-border' },
  { name: 'input', swatch: 'bg-input' },
  { name: 'ring', swatch: 'bg-ring' },
];

const CHARTS = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
  'bg-chart-6',
  'bg-chart-7',
  'bg-chart-8',
];

function Swatch({
  name,
  className,
}: {
  name: string;
  className: string;
}): ReactElement {
  return (
    <div className="space-y-1">
      <div
        className={cn(
          'flex h-12 items-center justify-center rounded-md border text-sm font-medium',
          className
        )}
      >
        Aa
      </div>
      <p className="truncate text-xs text-muted-foreground">{name}</p>
    </div>
  );
}

export function Section(): ReactElement {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SURFACES.map((s) => (
          <Swatch key={s.name} name={s.name} className={s.swatch} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATES.map((s) => (
          <div key={s.name} className="space-y-1">
            <Swatch name={s.name} className={s.solid} />
            <div className={cn('rounded-md border px-2 py-1 text-xs', s.soft)}>
              soft {s.name}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {LINES.map((s) => (
          <Swatch key={s.name} name={s.name} className={s.swatch} />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
        {CHARTS.map((c) => (
          <Swatch key={c} name={c.replace('bg-', '')} className={c} />
        ))}
      </div>
    </div>
  );
}
