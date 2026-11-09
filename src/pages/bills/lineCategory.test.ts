import { describe, it, expect } from 'vitest';
import { formatLineCategory, lineCategory } from './lineCategory';

const cheese = { id: 's1', name: 'Cheese', category_name: 'Dairy' };
const dairy = { id: 'c1', name: 'Dairy' };

describe('lineCategory', () => {
  it('takes the line category when the server sends it', () => {
    expect(lineCategory({ sub_category: null, category: dairy })).toEqual({
      key: 'c1',
      name: 'Dairy',
    });
  });

  it("falls back to the sub-category's category on an older response", () => {
    expect(lineCategory({ sub_category: cheese })).toEqual({
      key: 'name:Dairy',
      name: 'Dairy',
    });
  });

  it('is null when the line has neither', () => {
    expect(lineCategory({ sub_category: null, category: null })).toBeNull();
  });
});

describe('formatLineCategory', () => {
  it('shows category and sub-category', () => {
    expect(formatLineCategory({ sub_category: cheese, category: dairy })).toBe(
      'Dairy › Cheese'
    );
  });

  it('shows the category alone when there is no sub-category', () => {
    expect(formatLineCategory({ sub_category: null, category: dairy })).toBe(
      'Dairy'
    );
  });

  it('is null when the line has no category', () => {
    expect(
      formatLineCategory({ sub_category: null, category: null })
    ).toBeNull();
  });

  it('works on an older response without the category field', () => {
    expect(formatLineCategory({ sub_category: cheese })).toBe('Dairy › Cheese');
    expect(formatLineCategory({ sub_category: null })).toBeNull();
  });
});
