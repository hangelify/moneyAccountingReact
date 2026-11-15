import { describe, it, expect } from 'vitest';
import {
  canGoNext,
  formatRangeLabel,
  localIsoDate,
  rangeForParams,
  shiftParams,
  validateCustomRange,
} from './period';

const OCT = { start: '2026-10-01', end: '2026-11-01' };

// ICU may use narrow/thin spaces around the range dash.
const norm = (s: string): string => s.replace(/\s/g, ' ');

describe('localIsoDate', () => {
  it('uses local date parts, not UTC', () => {
    expect(localIsoDate(new Date(2026, 9, 31, 23, 30))).toBe('2026-10-31');
    expect(localIsoDate(new Date(2026, 0, 1, 0, 15))).toBe('2026-01-01');
  });
});

describe('rangeForParams', () => {
  const anchor = '2026-10-31';

  it('covers the ISO week, Monday to Sunday', () => {
    expect(rangeForParams({ period: 'week', anchor })).toEqual({
      start: '2026-10-26',
      end: '2026-11-02',
    });
  });

  it('covers a Sunday anchor in the week that started on Monday', () => {
    expect(rangeForParams({ period: 'week', anchor: '2026-11-01' })).toEqual({
      start: '2026-10-26',
      end: '2026-11-02',
    });
  });

  it('covers month, quarter and year', () => {
    expect(rangeForParams({ period: 'month', anchor })).toEqual(OCT);
    expect(rangeForParams({ period: 'quarter', anchor })).toEqual({
      start: '2026-10-01',
      end: '2027-01-01',
    });
    expect(rangeForParams({ period: 'year', anchor })).toEqual({
      start: '2026-01-01',
      end: '2027-01-01',
    });
  });

  it('covers the last 60 months for 5y', () => {
    expect(rangeForParams({ period: '5y', anchor })).toEqual({
      start: '2021-11-01',
      end: '2026-11-01',
    });
  });

  it('makes custom end exclusive', () => {
    expect(
      rangeForParams({ period: 'custom', from: '2026-03-05', to: '2026-03-20' })
    ).toEqual({ start: '2026-03-05', end: '2026-03-21' });
  });
});

describe('shiftParams', () => {
  it('steps a month back and forward', () => {
    const p = { period: 'month', anchor: '2026-10-31' } as const;
    expect(shiftParams(p, OCT, -1)).toEqual({
      period: 'month',
      anchor: '2026-09-30',
    });
    expect(shiftParams(p, OCT, 1)).toEqual({
      period: 'month',
      anchor: '2026-11-01',
    });
  });

  it('steps a year back across the year boundary', () => {
    expect(
      shiftParams(
        { period: 'year', anchor: '2026-01-01' },
        { start: '2026-01-01', end: '2027-01-01' },
        -1
      )
    ).toEqual({ period: 'year', anchor: '2025-12-31' });
  });

  it('shifts a custom window by its own length', () => {
    const p = {
      period: 'custom',
      from: '2026-03-05',
      to: '2026-03-20',
    } as const;
    const r = { start: '2026-03-05', end: '2026-03-21' };
    expect(shiftParams(p, r, -1)).toEqual({
      period: 'custom',
      from: '2026-02-17',
      to: '2026-03-04',
    });
    expect(shiftParams(p, r, 1)).toEqual({
      period: 'custom',
      from: '2026-03-21',
      to: '2026-04-05',
    });
  });
});

describe('canGoNext', () => {
  it('is false while the range contains today', () => {
    expect(canGoNext(OCT, '2026-10-31')).toBe(false);
  });

  it('is true for a past range', () => {
    expect(
      canGoNext({ start: '2026-09-01', end: '2026-10-01' }, '2026-10-31')
    ).toBe(true);
  });
});

describe('validateCustomRange', () => {
  it('accepts a range just under 10 years', () => {
    expect(validateCustomRange('2016-11-01', '2026-10-31')).toBeNull();
  });

  it('rejects 10 years or more', () => {
    expect(validateCustomRange('2016-11-01', '2026-11-01')).toBe('tooLong');
  });

  it('rejects an end before the start', () => {
    expect(validateCustomRange('2026-03-02', '2026-03-01')).toBe(
      'endBeforeStart'
    );
  });

  it('accepts a single day', () => {
    expect(validateCustomRange('2026-03-01', '2026-03-01')).toBeNull();
  });
});

describe('formatRangeLabel', () => {
  it('formats a week as a day range', () => {
    expect(
      norm(
        formatRangeLabel(
          'week',
          { start: '2026-10-26', end: '2026-11-02' },
          'en-GB'
        )
      )
    ).toBe('26 Oct – 1 Nov 2026');
  });

  it('formats month, quarter and year', () => {
    expect(formatRangeLabel('month', OCT, 'en-GB')).toBe('October 2026');
    expect(
      formatRangeLabel(
        'quarter',
        { start: '2026-10-01', end: '2027-01-01' },
        'en-GB'
      )
    ).toBe('Q4 2026');
    expect(
      formatRangeLabel(
        'year',
        { start: '2026-01-01', end: '2027-01-01' },
        'en-GB'
      )
    ).toBe('2026');
  });

  it('formats 5y as a day range with the inclusive end', () => {
    expect(
      norm(
        formatRangeLabel(
          '5y',
          { start: '2021-11-01', end: '2026-11-01' },
          'en-GB'
        )
      )
    ).toBe('1 Nov 2021 – 31 Oct 2026');
  });
});
