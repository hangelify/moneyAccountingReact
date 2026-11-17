import { describe, it, expect } from 'vitest';
import { billDetailParent } from './billDetailParent';

describe('billDetailParent', () => {
  it.each([
    ['/bills/b1', '/bills'],
    ['/bills/confirmed/b1', '/bills/confirmed'],
    ['/bills/drafts/b1', '/bills/drafts'],
    ['/bills/confirmed', null],
    ['/bills/review', null],
    ['/bills/duplicates', null],
    ['/bills', null],
    ['/dashboard', null],
  ])('%s -> %s', (path, expected) => {
    expect(billDetailParent(path)).toBe(expected);
  });
});
