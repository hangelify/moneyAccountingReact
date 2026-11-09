import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DecimalInput } from './DecimalInput';

function Controlled({
  initial,
  onValueChange,
}: {
  initial: number | null;
  onValueChange?: (v: number | null) => void;
}): React.ReactElement {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DecimalInput
        aria-label="amount"
        value={value}
        onValueChange={(v) => {
          setValue(v);
          onValueChange?.(v);
        }}
      />
      <button type="button" onClick={() => setValue(7.25)}>
        reset
      </button>
    </>
  );
}

const field = (): HTMLInputElement => screen.getByLabelText('amount');

describe('DecimalInput', () => {
  it('opens the decimal keypad on phones', () => {
    render(<Controlled initial={1} />);
    expect(field()).toHaveAttribute('inputmode', 'decimal');
  });

  it('can be cleared without snapping back to 0', async () => {
    const onValueChange = vi.fn();
    render(<Controlled initial={10} onValueChange={onValueChange} />);
    await userEvent.clear(field());
    expect(field()).toHaveValue('');
    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it('keeps the dot while a fraction is being typed', async () => {
    const onValueChange = vi.fn();
    render(<Controlled initial={null} onValueChange={onValueChange} />);
    await userEvent.type(field(), '12.');
    expect(field()).toHaveValue('12.');
    expect(onValueChange).toHaveBeenLastCalledWith(12);
    await userEvent.type(field(), '5');
    expect(field()).toHaveValue('12.5');
    expect(onValueChange).toHaveBeenLastCalledWith(12.5);
  });

  it('accepts a comma as the separator', async () => {
    const onValueChange = vi.fn();
    render(<Controlled initial={null} onValueChange={onValueChange} />);
    await userEvent.type(field(), '12,5');
    expect(field()).toHaveValue('12,5');
    expect(onValueChange).toHaveBeenLastCalledWith(12.5);
  });

  it('ignores keystrokes that would not make a number', async () => {
    render(<Controlled initial={null} />);
    await userEvent.type(field(), '1a2.3.');
    expect(field()).toHaveValue('12.3');
  });

  it('shows a value set from outside', async () => {
    render(<Controlled initial={1} />);
    await userEvent.click(screen.getByRole('button', { name: 'reset' }));
    expect(field()).toHaveValue('7.25');
  });

  it('flags an empty field with the missing message', () => {
    render(
      <DecimalInput
        aria-label="amount"
        value={null}
        onValueChange={vi.fn()}
        missingMessage="Enter an amount"
      />
    );
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(field()).toHaveAccessibleDescription('Enter an amount');
  });

  it('shows no message while the field has a value', () => {
    render(
      <DecimalInput
        aria-label="amount"
        value={3}
        onValueChange={vi.fn()}
        missingMessage="Enter an amount"
      />
    );
    expect(field()).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('Enter an amount')).toBeNull();
  });
});
