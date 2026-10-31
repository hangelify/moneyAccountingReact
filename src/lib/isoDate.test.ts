import { describe, it, expect } from 'vitest';
import {
  addDays,
  addMonths,
  addYears,
  diffDays,
  parseIsoDate,
} from './isoDate';

describe('parseIsoDate', () => {
  it('accepts a real calendar date', () => {
    expect(parseIsoDate('2026-10-31')).toBe('2026-10-31');
  });

  it('rejects normalized and malformed dates', () => {
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('2026/10/31')).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
  });
});

describe('date arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('adds months, clamping the day to the month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-01', -59)).toBe('2021-12-01');
  });

  it('adds years', () => {
    expect(addYears('2016-11-01', 10)).toBe('2026-11-01');
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
  });

  it('counts days from a to b', () => {
    expect(diffDays('2026-03-05', '2026-03-20')).toBe(15);
    expect(diffDays('2026-03-20', '2026-03-05')).toBe(-15);
  });
});
