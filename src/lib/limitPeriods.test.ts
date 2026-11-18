import { describe, it, expect } from 'vitest';
import {
  LIMIT_PERIOD_TYPES,
  limitPeriodEnd,
  limitPeriodStart,
  periodStartsBetween,
  todayUtcIsoDate,
  type LimitPeriodType,
} from './limitPeriods';

describe('limitPeriodStart / limitPeriodEnd', () => {
  it.each<[LimitPeriodType, string, string, string]>([
    ['MONTHLY', '2026-01-31', '2026-01-01', '2026-02-01'],
    ['MONTHLY', '2026-12-15', '2026-12-01', '2027-01-01'],
    ['MONTHLY', '2028-02-29', '2028-02-01', '2028-03-01'],
    ['QUARTERLY', '2026-11-18', '2026-10-01', '2027-01-01'],
    ['QUARTERLY', '2026-04-01', '2026-04-01', '2026-07-01'],
    ['SEMI_ANNUAL', '2026-06-30', '2026-01-01', '2026-07-01'],
    ['SEMI_ANNUAL', '2026-07-01', '2026-07-01', '2027-01-01'],
    ['YEARLY', '2026-11-18', '2026-01-01', '2027-01-01'],
  ])('%s %s → [%s, %s)', (type, date, start, end) => {
    expect(limitPeriodStart(type, date)).toBe(start);
    expect(limitPeriodEnd(type, date)).toBe(end);
  });

  it('lists the four types in order', () => {
    expect(LIMIT_PERIOD_TYPES).toEqual([
      'MONTHLY',
      'QUARTERLY',
      'SEMI_ANNUAL',
      'YEARLY',
    ]);
  });
});

describe('periodStartsBetween', () => {
  it('lists period starts in the inclusive range', () => {
    expect(periodStartsBetween('MONTHLY', '2026-10-01', '2026-11-01')).toEqual([
      '2026-10-01',
      '2026-11-01',
    ]);
  });

  it('crosses a year boundary', () => {
    expect(
      periodStartsBetween('QUARTERLY', '2026-10-01', '2027-01-01')
    ).toEqual(['2026-10-01', '2027-01-01']);
  });

  it('is empty when the range is reversed', () => {
    expect(periodStartsBetween('MONTHLY', '2026-11-01', '2026-10-01')).toEqual(
      []
    );
  });
});

describe('todayUtcIsoDate', () => {
  it('uses the UTC date west of UTC', () => {
    expect(todayUtcIsoDate(new Date('2026-11-30T23:30:00-01:00'))).toBe(
      '2026-12-01'
    );
  });

  it('uses the UTC date east of UTC', () => {
    expect(todayUtcIsoDate(new Date('2026-12-01T00:30:00+02:00'))).toBe(
      '2026-11-30'
    );
  });
});
