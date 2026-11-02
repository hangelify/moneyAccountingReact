import { describe, it, expect } from 'vitest';
import { householdPath } from './households';

describe('householdPath', () => {
  it('encodes the household id and appends the path', () => {
    expect(householdPath('a b', '/bills')).toBe('/households/a%20b/bills');
  });

  it('defaults to the household root', () => {
    expect(householdPath('h1')).toBe('/households/h1');
  });
});
