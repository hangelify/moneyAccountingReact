import '@/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangePicker } from './DateRangePicker';

describe('DateRangePicker', () => {
  it('emits new from/to on change', () => {
    const onChange = vi.fn();
    render(<DateRangePicker from={null} to={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/from/i), {
      target: { value: '2026-01-01' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      from: '2026-01-01',
      to: null,
    });
  });

  it('clears value to null when emptied', () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker from="2026-01-01" to="2026-06-30" onChange={onChange} />
    );
    fireEvent.change(screen.getByLabelText(/from/i), {
      target: { value: '' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      from: null,
      to: '2026-06-30',
    });
  });

  it('shows validation message when to < from', () => {
    render(
      <DateRangePicker from="2026-06-30" to="2026-01-01" onChange={vi.fn()} />
    );
    expect(
      screen.getByText(/end date is before start date/i)
    ).toBeInTheDocument();
  });
});
