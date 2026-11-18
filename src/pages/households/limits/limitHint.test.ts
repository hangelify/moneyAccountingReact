import { describe, it, expect } from 'vitest';
import { formatPeriod, limitHint } from './limitHint';
import { makeLimit } from './testLimits';

const TODAY = '2026-11-18';

describe('limitHint', () => {
  it('starts a new monthly limit this month', () => {
    expect(limitHint('MONTHLY', null, TODAY)).toEqual({
      start: '2026-11-01',
      lostPeriods: null,
    });
  });

  it('lists months left without a limit when a monthly limit becomes quarterly', () => {
    expect(limitHint('QUARTERLY', makeLimit(), TODAY)).toEqual({
      start: '2026-10-01',
      lostPeriods: { type: 'MONTHLY', starts: ['2026-10-01', '2026-11-01'] },
    });
  });

  it('loses nothing when a quarterly limit becomes monthly', () => {
    const quarterly = makeLimit({ period_type: 'QUARTERLY' });
    expect(limitHint('MONTHLY', quarterly, TODAY)).toEqual({
      start: '2026-11-01',
      lostPeriods: null,
    });
  });

  it('loses nothing for the same period type', () => {
    expect(limitHint('MONTHLY', makeLimit(), TODAY).lostPeriods).toBeNull();
  });

  it('loses nothing for an ending limit', () => {
    const ending = makeLimit({ effective_to: '2026-12-01' });
    expect(limitHint('QUARTERLY', ending, TODAY).lostPeriods).toBeNull();
  });
});

describe('formatPeriod', () => {
  it.each([
    ['MONTHLY', '2026-11-01', 'November 2026'],
    ['QUARTERLY', '2026-10-01', 'Q4 2026'],
    ['SEMI_ANNUAL', '2026-07-01', 'H2 2026'],
    ['YEARLY', '2026-01-01', '2026'],
  ] as const)('%s %s → %s', (type, start, label) => {
    expect(formatPeriod(type, start, 'en')).toBe(label);
  });
});
