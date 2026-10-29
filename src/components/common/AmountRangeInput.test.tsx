import '@/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AmountRangeInput } from './AmountRangeInput';

describe('AmountRangeInput', () => {
  it('emits {min, max} when typing into either field', () => {
    const onChange = vi.fn();
    render(<AmountRangeInput min={null} max={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/min/i), {
      target: { value: '100' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ min: 100, max: null });
    fireEvent.change(screen.getByLabelText(/max/i), {
      target: { value: '500' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ min: null, max: 500 });
  });

  it('clears empty input to null', async () => {
    const onChange = vi.fn();
    render(<AmountRangeInput min={100} max={500} onChange={onChange} />);
    await userEvent.clear(screen.getByLabelText(/min/i));
    expect(onChange).toHaveBeenLastCalledWith({ min: null, max: 500 });
  });

  it('shows validation message when min > max', () => {
    render(<AmountRangeInput min={500} max={100} onChange={vi.fn()} />);
    expect(
      screen.getByText(/minimum cannot be greater than maximum/i)
    ).toBeInTheDocument();
  });
});
