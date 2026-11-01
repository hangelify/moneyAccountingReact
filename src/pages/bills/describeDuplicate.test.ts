import '@/i18n';
import { describe, it, expect } from 'vitest';
import i18n from '@/i18n';
import type { PossibleDuplicate } from '@/types/bills';
import { describeDuplicate } from './describeDuplicate';

const t = i18n.getFixedT('en', 'bills');

const cand = (
  overrides: Partial<PossibleDuplicate> = {}
): PossibleDuplicate => ({
  id: 'b0',
  bill_date: '2026-10-03',
  total_amount: 412.5,
  currency: 'MDL',
  market_name: 'Linella',
  created_by_name: 'Ana',
  match: 'strong',
  ...overrides,
});

describe('describeDuplicate', () => {
  it('fiscal names the receipt, market and amount', () => {
    const text = describeDuplicate(t, cand({ match: 'fiscal' }), 'en');
    expect(text).toContain('Ana already added this receipt');
    expect(text).toContain('Linella');
    expect(text).toContain('412.50');
  });

  it('strong names who and when', () => {
    expect(describeDuplicate(t, cand(), 'en')).toContain(
      'Ana already added this on Oct 3'
    );
  });

  it('weak only says the amount and date match', () => {
    expect(
      describeDuplicate(t, cand({ match: 'weak' }), 'en').startsWith(
        'A bill with the same amount and date exists'
      )
    ).toBe(true);
  });

  it('reads naturally when name, market and currency are null', () => {
    const text = describeDuplicate(
      t,
      cand({ created_by_name: null, market_name: null, currency: null }),
      'en'
    );
    expect(text).toContain('Someone');
    expect(text).not.toContain('null');
    expect(text).toContain('412.50');
  });
});
