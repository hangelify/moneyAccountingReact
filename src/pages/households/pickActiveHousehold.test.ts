import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Household } from '@/types/households';
import {
  pickActiveHousehold,
  readRememberedHouseholdId,
  writeRememberedHouseholdId,
} from './pickActiveHousehold';

const h = (id: string): Household => ({
  id,
  name: id,
  created_at: '2026-06-03T12:00:00.000Z',
  member_count: 1,
});

describe('pickActiveHousehold', () => {
  const list = [h('a'), h('b')];

  it('returns the remembered household when present', () => {
    expect(pickActiveHousehold(list, 'b')).toBe(list[1]);
  });
  it('falls back to the first for a stale id', () => {
    expect(pickActiveHousehold(list, 'gone')).toBe(list[0]);
  });
  it('falls back to the first for null', () => {
    expect(pickActiveHousehold(list, null)).toBe(list[0]);
  });
  it('returns null for an empty list', () => {
    expect(pickActiveHousehold([], 'a')).toBeNull();
  });
});

describe('remembered household id storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('round-trips and removes on null', () => {
    writeRememberedHouseholdId('h1');
    expect(readRememberedHouseholdId()).toBe('h1');
    writeRememberedHouseholdId(null);
    expect(readRememberedHouseholdId()).toBeNull();
  });

  it('readRememberedHouseholdId returns null when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error();
    });
    expect(readRememberedHouseholdId()).toBeNull();
  });

  it('writeRememberedHouseholdId does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error();
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error();
    });
    expect(() => writeRememberedHouseholdId('h1')).not.toThrow();
    expect(() => writeRememberedHouseholdId(null)).not.toThrow();
  });
});
