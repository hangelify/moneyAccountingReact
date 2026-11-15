import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnitSelect } from './UnitSelect';

describe('UnitSelect', () => {
  it('lists the units with a dash for "no unit"', () => {
    render(<UnitSelect aria-label="Unit" value="" onChange={vi.fn()} />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '—',
      'kg',
      'g',
      'l',
      'ml',
      'piece',
    ]);
  });

  it('emits the picked unit', async () => {
    const onChange = vi.fn();
    render(<UnitSelect aria-label="Unit" value="piece" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'kg');
    expect(onChange).toHaveBeenCalledWith('kg');
  });

  it('passes the id through for the label', () => {
    render(
      <>
        <label htmlFor="u">Unit</label>
        <UnitSelect id="u" value="kg" onChange={vi.fn()} />
      </>
    );
    expect(screen.getByLabelText('Unit')).toHaveValue('kg');
  });

  // The table's unit column is narrow: the row tightens the padding.
  it('merges className onto the select', () => {
    render(
      <UnitSelect
        aria-label="Unit"
        value="kg"
        onChange={vi.fn()}
        className="px-2"
      />
    );
    expect(screen.getByRole('combobox')).toHaveClass('px-2');
    expect(screen.getByRole('combobox')).not.toHaveClass('px-3');
  });
});
