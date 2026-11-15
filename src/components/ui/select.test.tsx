import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './select';

describe('Select', () => {
  it('forwards the ref to the native select', () => {
    const ref = createRef<HTMLSelectElement>();
    render(<Select ref={ref} aria-label="s" />);
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  it('merges className over the base classes', () => {
    render(<Select aria-label="s" className="w-24" />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveClass('w-24', 'rounded-md');
    expect(select).not.toHaveClass('w-full');
  });

  it('calls onChange with the picked option', async () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="s" defaultValue="a" onChange={onChange}>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>
    );
    const select = screen.getByRole<HTMLSelectElement>('combobox');
    await userEvent.selectOptions(select, 'b');
    expect(onChange).toHaveBeenCalled();
    expect(select.value).toBe('b');
  });

  it('is disabled', () => {
    render(<Select aria-label="s" disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('marks itself invalid', () => {
    render(<Select aria-label="s" aria-invalid="true" />);
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });
});
