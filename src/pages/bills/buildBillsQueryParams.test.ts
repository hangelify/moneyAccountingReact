import { describe, it, expect } from 'vitest';
import { buildBillsQueryParams } from './buildBillsQueryParams';
import type { ConfirmedBillsFilters } from './buildBillsQueryParams';

const empty: ConfirmedBillsFilters = {
  date_from: null,
  date_to: null,
  market_names: [],
  amount_min: null,
  amount_max: null,
  currency: null,
};

describe('buildBillsQueryParams', () => {
  it('emits only page and limit when no filters set', () => {
    expect(buildBillsQueryParams(empty, 1, 20)).toEqual({
      page: '1',
      limit: '20',
    });
  });

  it('emits date_from and date_to when set', () => {
    const out = buildBillsQueryParams(
      { ...empty, date_from: '2026-01-01', date_to: '2026-06-30' },
      1,
      20
    );
    expect(out).toMatchObject({
      date_from: '2026-01-01',
      date_to: '2026-06-30',
    });
  });

  it('emits market_names as a string[] for repeat-key serialization', () => {
    const out = buildBillsQueryParams(
      { ...empty, market_names: ['Lidl', 'Kaufland'] },
      1,
      20
    );
    expect(out.market_names).toEqual(['Lidl', 'Kaufland']);
  });

  it('omits market_names entirely when empty', () => {
    const out = buildBillsQueryParams(empty, 1, 20);
    expect('market_names' in out).toBe(false);
  });

  it('emits amount_range=gt_X,lt_Y when both bounds set', () => {
    const out = buildBillsQueryParams(
      { ...empty, amount_min: 100, amount_max: 500 },
      1,
      20
    );
    expect(out.amount_range).toBe('gt_100,lt_500');
  });

  it('emits amount_range=gt_X when only min set', () => {
    const out = buildBillsQueryParams(
      { ...empty, amount_min: 100, amount_max: null },
      1,
      20
    );
    expect(out.amount_range).toBe('gt_100');
  });

  it('emits amount_range=lt_Y when only max set', () => {
    const out = buildBillsQueryParams(
      { ...empty, amount_min: null, amount_max: 500 },
      1,
      20
    );
    expect(out.amount_range).toBe('lt_500');
  });

  it('omits amount_range when neither bound set', () => {
    const out = buildBillsQueryParams(empty, 1, 20);
    expect('amount_range' in out).toBe(false);
  });

  it('emits currency when set', () => {
    const out = buildBillsQueryParams({ ...empty, currency: 'EUR' }, 1, 20);
    expect(out.currency).toBe('EUR');
  });

  it('clamps limit to 100', () => {
    expect(buildBillsQueryParams(empty, 1, 999).limit).toBe('100');
  });

  it('floors page and limit to integers >= 1', () => {
    expect(buildBillsQueryParams(empty, 0, 0)).toMatchObject({
      page: '1',
      limit: '1',
    });
  });
});
