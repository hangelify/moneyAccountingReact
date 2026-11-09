import { describe, it, expect } from 'vitest';
import { isDecimalDraft, parseDecimal } from './decimal';

describe('parseDecimal', () => {
  it('reads a dot or a comma as the decimal separator', () => {
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(parseDecimal('12,5')).toBe(12.5);
  });

  it('reads a trailing separator as the whole number', () => {
    expect(parseDecimal('12.')).toBe(12);
    expect(parseDecimal('12,')).toBe(12);
  });

  it('reads a leading separator as a fraction', () => {
    expect(parseDecimal('.5')).toBe(0.5);
  });

  it('returns null for empty or blank input', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('  ')).toBeNull();
    expect(parseDecimal('.')).toBeNull();
  });

  it('returns null for anything that is not a plain decimal', () => {
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('1.2.3')).toBeNull();
    expect(parseDecimal('-1')).toBeNull();
    expect(parseDecimal('1e3')).toBeNull();
  });
});

describe('isDecimalDraft', () => {
  it('accepts partial input the user is still typing', () => {
    expect(isDecimalDraft('')).toBe(true);
    expect(isDecimalDraft('12')).toBe(true);
    expect(isDecimalDraft('12.')).toBe(true);
    expect(isDecimalDraft('12,')).toBe(true);
    expect(isDecimalDraft(',5')).toBe(true);
  });

  it('rejects letters, signs and a second separator', () => {
    expect(isDecimalDraft('12a')).toBe(false);
    expect(isDecimalDraft('-1')).toBe(false);
    expect(isDecimalDraft('1.2.')).toBe(false);
    expect(isDecimalDraft('1,2.3')).toBe(false);
  });
});
