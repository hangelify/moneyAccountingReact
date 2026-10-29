import { describe, it, expect } from 'vitest';
import { parseBillsSearchParams } from './parseBillsSearchParams';

function p(qs: string): URLSearchParams {
  return new URLSearchParams(qs);
}

describe('parseBillsSearchParams', () => {
  it('returns defaults for empty query', () => {
    expect(parseBillsSearchParams(p(''))).toEqual({
      filters: {
        date_from: null,
        date_to: null,
        market_names: [],
        amount_min: null,
        amount_max: null,
        currency: null,
      },
      page: 1,
      limit: 20,
    });
  });

  it('parses every filter and pagination value', () => {
    const r = parseBillsSearchParams(
      p(
        'date_from=2026-01-01&date_to=2026-06-30' +
          '&market_names=Lidl&market_names=Kaufland' +
          '&amount_range=gt_100,lt_500&currency=EUR&page=2&limit=50'
      )
    );
    expect(r).toEqual({
      filters: {
        date_from: '2026-01-01',
        date_to: '2026-06-30',
        market_names: ['Lidl', 'Kaufland'],
        amount_min: 100,
        amount_max: 500,
        currency: 'EUR',
      },
      page: 2,
      limit: 50,
    });
  });

  it('parses amount_range=gt_X only', () => {
    const r = parseBillsSearchParams(p('amount_range=gt_100'));
    expect(r.filters.amount_min).toBe(100);
    expect(r.filters.amount_max).toBeNull();
  });

  it('parses amount_range=lt_Y only', () => {
    const r = parseBillsSearchParams(p('amount_range=lt_500'));
    expect(r.filters.amount_min).toBeNull();
    expect(r.filters.amount_max).toBe(500);
  });

  it('coerces malformed amount_range to null bounds', () => {
    const r = parseBillsSearchParams(p('amount_range=foo,bar'));
    expect(r.filters.amount_min).toBeNull();
    expect(r.filters.amount_max).toBeNull();
  });

  it('coerces invalid date strings to null', () => {
    const r = parseBillsSearchParams(
      p('date_from=not-a-date&date_to=2026-13-99')
    );
    expect(r.filters.date_from).toBeNull();
    expect(r.filters.date_to).toBeNull();
  });

  it('coerces unknown currency to null', () => {
    const r = parseBillsSearchParams(p('currency=ZZZ'));
    expect(r.filters.currency).toBeNull();
  });

  it('coerces non-numeric page/limit to defaults', () => {
    const r = parseBillsSearchParams(p('page=abc&limit=xyz'));
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
  });

  it('clamps limit to 100', () => {
    expect(parseBillsSearchParams(p('limit=500')).limit).toBe(100);
  });

  it('dedupes and filters empty market_names', () => {
    const r = parseBillsSearchParams(
      p('market_names=Lidl&market_names=Lidl&market_names=')
    );
    expect(r.filters.market_names).toEqual(['Lidl']);
  });
});
