import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CurrencySelect } from './CurrencySelect';

describe('CurrencySelect', () => {
  it('renders an "All currencies" option that emits null', async () => {
    const onChange = vi.fn();
    render(<CurrencySelect value="EUR" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), '');
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('renders all known currencies and emits the selected code', async () => {
    const onChange = vi.fn();
    render(<CurrencySelect value={null} onChange={onChange} />);
    const select = screen.getByRole('combobox');
    // EUR is in the European group; should be present.
    expect(screen.getByRole('option', { name: 'EUR' })).toBeInTheDocument();
    await userEvent.selectOptions(select, 'EUR');
    expect(onChange).toHaveBeenCalledWith('EUR');
  });

  it('reflects the controlled value', () => {
    render(<CurrencySelect value="USD" onChange={vi.fn()} />);
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('USD');
  });
});
