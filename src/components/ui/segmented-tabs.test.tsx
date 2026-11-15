import { useState, type ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  SegmentedNav,
  SegmentedTabs,
  type SegmentedVariant,
} from './segmented-tabs';

type V = 'a' | 'b' | 'c';

function Harness({
  initial = 'a',
  disabled = [],
  variant,
  onChange,
  idPrefix,
}: {
  initial?: V;
  disabled?: V[];
  variant?: SegmentedVariant;
  onChange?: (v: V) => void;
  idPrefix?: string;
}): ReactElement {
  const [value, setValue] = useState<V>(initial);
  return (
    <SegmentedTabs<V>
      aria-label="Views"
      variant={variant}
      idPrefix={idPrefix}
      value={value}
      onValueChange={(v) => {
        onChange?.(v);
        setValue(v);
      }}
      items={(['a', 'b', 'c'] as const).map((v) => ({
        value: v,
        label: v.toUpperCase(),
        disabled: disabled.includes(v),
      }))}
    />
  );
}

const tab = (name: string): HTMLElement => screen.getByRole('tab', { name });

describe('SegmentedTabs', () => {
  it('marks the selected tab', () => {
    render(<Harness initial="b" />);
    expect(screen.getByRole('tablist', { name: 'Views' })).toBeInTheDocument();
    expect(tab('B')).toHaveAttribute('aria-selected', 'true');
    expect(tab('B')).toHaveAttribute('tabindex', '0');
    expect(tab('A')).toHaveAttribute('aria-selected', 'false');
    expect(tab('A')).toHaveAttribute('tabindex', '-1');
    expect(tab('C')).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowRight moves and wraps', async () => {
    render(<Harness initial="c" />);
    tab('C').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(tab('A')).toHaveAttribute('aria-selected', 'true');
    expect(tab('A')).toHaveFocus();
  });

  it('ArrowLeft moves and wraps', async () => {
    render(<Harness initial="a" />);
    tab('A').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(tab('C')).toHaveAttribute('aria-selected', 'true');
    expect(tab('C')).toHaveFocus();
  });

  it('Home and End', async () => {
    render(<Harness initial="b" />);
    tab('B').focus();
    await userEvent.keyboard('{End}');
    expect(tab('C')).toHaveFocus();
    expect(tab('C')).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Home}');
    expect(tab('A')).toHaveFocus();
    expect(tab('A')).toHaveAttribute('aria-selected', 'true');
  });

  it('skips disabled tabs', async () => {
    render(<Harness initial="a" disabled={['b']} />);
    tab('A').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(tab('C')).toHaveFocus();
    expect(tab('C')).toHaveAttribute('aria-selected', 'true');
  });

  it('does nothing when every other tab is disabled', async () => {
    const onChange = vi.fn();
    render(<Harness initial="a" disabled={['b', 'c']} onChange={onChange} />);
    tab('A').focus();
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}{End}');
    expect(onChange).not.toHaveBeenCalled();
    expect(tab('A')).toHaveFocus();
  });

  it('falls back to the first enabled tab when the selected one is disabled', () => {
    render(<Harness initial="b" disabled={['b']} />);
    expect(tab('A')).toHaveAttribute('tabindex', '0');
    expect(tab('B')).toHaveAttribute('tabindex', '-1');
    expect(tab('B')).toBeDisabled();
  });

  it('click selects', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(tab('C'));
    expect(onChange).toHaveBeenCalledWith('c');
    expect(tab('C')).toHaveAttribute('aria-selected', 'true');
  });

  it('links tabs to the panel', () => {
    render(<Harness idPrefix="x" />);
    expect(tab('A')).toHaveAttribute('id', 'x-tab-a');
    expect(tab('A')).toHaveAttribute('aria-controls', 'x-panel');
  });

  it('renders no ids without idPrefix', () => {
    render(<Harness />);
    expect(tab('A')).not.toHaveAttribute('id');
    expect(tab('A')).not.toHaveAttribute('aria-controls');
  });

  it('pill variant classes', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist')).toHaveClass(
      'inline-flex',
      'rounded-lg',
      'bg-muted',
      'p-1'
    );
    expect(tab('A')).toHaveClass('bg-background', 'shadow-sm');
    // One text colour only: the active one must not keep the muted colour.
    expect(tab('A')).toHaveClass('text-foreground');
    expect(tab('A')).not.toHaveClass('text-muted-foreground');
    expect(tab('B')).not.toHaveClass('bg-background');
  });

  it('underline variant classes', () => {
    render(<Harness variant="underline" />);
    expect(screen.getByRole('tablist')).toHaveClass('flex', 'border-b');
    expect(tab('A')).toHaveClass('border-foreground', 'text-foreground');
    expect(tab('B')).toHaveClass('border-transparent');
  });
});

describe('SegmentedNav', () => {
  it('marks the current page', () => {
    render(
      <MemoryRouter initialEntries={['/b']}>
        <SegmentedNav
          aria-label="Sections"
          items={[
            { to: '/a', label: 'A' },
            { to: '/b', label: 'B' },
          ]}
        />
      </MemoryRouter>
    );
    expect(
      screen.getByRole('navigation', { name: 'Sections' })
    ).toBeInTheDocument();
    const b = screen.getByRole('link', { name: 'B' });
    expect(b).toHaveAttribute('aria-current', 'page');
    expect(b).toHaveClass('border-foreground');
    const a = screen.getByRole('link', { name: 'A' });
    expect(a).not.toHaveAttribute('aria-current');
    expect(a).toHaveClass('border-transparent');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('end matches the exact path only', () => {
    render(
      <MemoryRouter initialEntries={['/bills/drafts']}>
        <SegmentedNav
          items={[
            { to: '/bills', label: 'All', end: true },
            { to: '/bills/drafts', label: 'Drafts' },
          ]}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'All' })).not.toHaveAttribute(
      'aria-current'
    );
    expect(screen.getByRole('link', { name: 'Drafts' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
