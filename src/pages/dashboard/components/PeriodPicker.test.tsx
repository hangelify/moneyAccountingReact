import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import type { SpendingBreakdownParams } from '@/types/dashboard';
import { rangeForParams } from '../period';
import { PeriodPicker } from './PeriodPicker';

// A parent that keeps params in state, like the card does with the URL.
function Harness({
  initial,
  onChange,
}: {
  initial: SpendingBreakdownParams;
  onChange: (p: SpendingBreakdownParams) => void;
}): ReactElement {
  const [params, setParams] = useState(initial);
  return (
    <PeriodPicker
      params={params}
      range={rangeForParams(params)}
      label="label"
      onChange={(p) => {
        onChange(p);
        setParams(p);
      }}
    />
  );
}

const MONTH: SpendingBreakdownParams = {
  period: 'month',
  anchor: '2026-10-31',
};

function setup(initial: SpendingBreakdownParams = MONTH): {
  onChange: ReturnType<typeof vi.fn>;
} {
  const onChange = vi.fn();
  render(<Harness initial={initial} onChange={onChange} />);
  return { onChange };
}

const fromInput = (): HTMLInputElement => screen.getByLabelText('From');
const toInput = (): HTMLInputElement => screen.getByLabelText('To');

describe('PeriodPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      now: new Date(2026, 9, 31, 12),
      toFake: ['setTimeout', 'clearTimeout', 'Date'],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("clicking Week calls onChange with week and today's anchor", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(onChange).toHaveBeenCalledWith({
      period: 'week',
      anchor: '2026-10-31',
    });
  });

  it('marks the current period as pressed', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('Previous calls onChange with the shifted params', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));
    expect(onChange).toHaveBeenCalledWith({
      period: 'month',
      anchor: '2026-09-30',
    });
  });

  it('Next is disabled when the range contains today', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Next period' })).toBeDisabled();
  });

  it('Next is enabled for a past range', () => {
    setup({ period: 'month', anchor: '2026-08-15' });
    expect(screen.getByRole('button', { name: 'Next period' })).toBeEnabled();
  });

  it('switching to Custom pre-fills the current range', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    expect(onChange).toHaveBeenCalledWith({
      period: 'custom',
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(fromInput().value).toBe('2026-10-01');
    expect(toInput().value).toBe('2026-10-31');
  });

  it('leaving Custom anchors on from', () => {
    const { onChange } = setup({
      period: 'custom',
      from: '2026-03-05',
      to: '2026-03-20',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Year' }));
    expect(onChange).toHaveBeenCalledWith({
      period: 'year',
      anchor: '2026-03-05',
    });
  });

  it('blocks a 10-year custom range', () => {
    const { onChange } = setup({
      period: 'custom',
      from: '2016-11-01',
      to: '2026-10-31',
    });
    fireEvent.change(toInput(), { target: { value: '2026-11-01' } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByText('Choose at most 10 years')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('blocks an end before the start', () => {
    const { onChange } = setup({
      period: 'custom',
      from: '2026-03-05',
      to: '2026-03-20',
    });
    fireEvent.change(toInput(), { target: { value: '2026-03-01' } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(
      screen.getByText(/End date is before start date/)
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('debounces valid custom edits', () => {
    const { onChange } = setup({
      period: 'custom',
      from: '2026-03-05',
      to: '2026-03-20',
    });
    fireEvent.change(toInput(), { target: { value: '2026-03-25' } });
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      period: 'custom',
      from: '2026-03-05',
      to: '2026-03-25',
    });
  });
});
