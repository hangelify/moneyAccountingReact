import { describe, it, expect } from 'vitest';
import type { CategoryResponse, SubCategoryResponse } from '@/types/categories';
import { buildCategoryTree, filterTree } from './categoryTree';
import type { CategoryNode } from './categoryTree';

function cat(id: string, name: string): CategoryResponse {
  return { id, name, created_at: '', updated_at: '' };
}

function sub(
  id: string,
  name: string,
  categoryId: string
): SubCategoryResponse {
  return {
    id,
    name,
    category_id: categoryId,
    category_name: '',
    created_at: '',
    updated_at: '',
  };
}

describe('buildCategoryTree', () => {
  it('keeps a category without sub-categories', () => {
    const tree = buildCategoryTree(
      [cat('c1', 'Dairy'), cat('c2', 'Snacks')],
      [sub('s1', 'Cheese', 'c1')]
    );
    expect(tree.find((node) => node.id === 'c2')).toEqual({
      id: 'c2',
      name: 'Snacks',
      subs: [],
    });
  });

  it('drops a sub-category whose category is missing', () => {
    const tree = buildCategoryTree(
      [cat('c1', 'Dairy')],
      [sub('s1', 'Cheese', 'c1'), sub('s2', 'Lost', 'gone')]
    );
    expect(tree.flatMap((node) => node.subs.map((s) => s.id))).toEqual(['s1']);
  });

  it('sorts categories and subs', () => {
    const tree = buildCategoryTree(
      [cat('c2', 'Snacks'), cat('c1', 'Dairy')],
      [sub('s2', 'Milk', 'c1'), sub('s1', 'Cheese', 'c1')]
    );
    expect(tree.map((node) => node.name)).toEqual(['Dairy', 'Snacks']);
    expect(tree[0]!.subs.map((s) => s.name)).toEqual(['Cheese', 'Milk']);
  });
});

describe('filterTree', () => {
  const tree: CategoryNode[] = [
    {
      id: 'c1',
      name: 'Dairy',
      subs: [
        { id: 's1', name: 'Cheese' },
        { id: 's2', name: 'Milk' },
      ],
    },
    {
      id: 'c2',
      name: 'Snacks',
      subs: [
        { id: 's3', name: 'Cheese crackers' },
        { id: 's4', name: 'Chips' },
      ],
    },
  ];

  const names = (nodes: CategoryNode[]): string[][] =>
    nodes.map((node) => [node.name, ...node.subs.map((s) => s.name)]);

  it('returns the tree for an empty query', () => {
    expect(filterTree(tree, '')).toEqual(tree);
  });

  it('treats a blank query as empty', () => {
    expect(filterTree(tree, '   ')).toEqual(tree);
  });

  it('keeps all subs of a matching category', () => {
    expect(names(filterTree(tree, 'dai'))).toEqual([
      ['Dairy', 'Cheese', 'Milk'],
    ]);
  });

  it('keeps only matching subs otherwise', () => {
    expect(names(filterTree(tree, 'chee'))).toEqual([
      ['Dairy', 'Cheese'],
      ['Snacks', 'Cheese crackers'],
    ]);
  });

  it('ignores case and surrounding spaces', () => {
    expect(names(filterTree(tree, '  MILK '))).toEqual([['Dairy', 'Milk']]);
  });

  it('returns nothing when nothing matches', () => {
    expect(filterTree(tree, 'zzz')).toEqual([]);
  });
});
