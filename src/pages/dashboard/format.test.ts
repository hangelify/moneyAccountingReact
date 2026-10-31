import { describe, it, expect } from 'vitest';
import { formatAmount } from './format';

describe('formatAmount', () => {
  it('formats a known currency with 2 decimals', () => {
    expect(formatAmount(5, 'EUR', 'en')).toContain('5.00');
    expect(formatAmount(5, 'EUR', 'en')).toContain('€');
  });

  it('falls back for null and invalid codes', () => {
    expect(formatAmount(1250.4, null, 'en')).toBe('1,250.40');
    expect(formatAmount(5, 'ABCD', 'en')).toBe('5.00 ABCD');
  });
});
