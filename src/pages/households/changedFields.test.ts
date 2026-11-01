import { describe, it, expect } from 'vitest';
import { TEST_HOUSEHOLDS } from '@/test/household';
import { changedFields } from './changedFields';

const [h] = TEST_HOUSEHOLDS as [(typeof TEST_HOUSEHOLDS)[number]];

describe('changedFields', () => {
  it('is empty when only whitespace around the name changed', () => {
    expect(changedFields(h, { name: 'Personal ', currency: 'EUR' })).toEqual(
      {}
    );
  });

  it('includes only the fields that changed', () => {
    expect(changedFields(h, { name: 'Personal', currency: 'MDL' })).toEqual({
      currency: 'MDL',
    });
    expect(changedFields(h, { name: 'Home', currency: 'MDL' })).toEqual({
      name: 'Home',
      currency: 'MDL',
    });
  });
});
