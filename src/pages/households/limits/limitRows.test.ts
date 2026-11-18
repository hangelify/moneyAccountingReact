import { describe, it, expect } from 'vitest';
import { buildLimitRows } from './limitRows';
import { makeCategory, makeLimit } from './testLimits';

describe('buildLimitRows', () => {
  const categories = [
    makeCategory('c3', 'Transport'),
    makeCategory('c1', 'Food'),
    makeCategory('c2', 'Rent'),
  ];
  const food = makeLimit();
  const rent = makeLimit({
    id: 'l2',
    category_id: 'c2',
    category_name: 'Rent',
    effective_to: '2026-12-01',
  });
  const archived = makeLimit({
    id: 'l3',
    category_id: 'x',
    category_name: 'Old',
    category_archived: true,
  });

  it('orders limited, then unlimited, then archived, by name', () => {
    const rows = buildLimitRows(categories, [archived, rent, food], 'EUR');
    expect(rows.map((r) => [r.name, r.state])).toEqual([
      ['Food', 'active'],
      ['Rent', 'ending'],
      ['Transport', 'none'],
      ['Old', 'archived'],
    ]);
    expect(rows[2]?.limit).toBeNull();
    expect(rows[0]?.limit).toBe(food);
  });

  it('flags a limit in another currency than the budget', () => {
    const rows = buildLimitRows(
      categories,
      [makeLimit({ currency: 'USD' })],
      'EUR'
    );
    expect(rows[0]?.otherCurrency).toBe(true);
    expect(rows[1]?.otherCurrency).toBe(false);
  });
});
