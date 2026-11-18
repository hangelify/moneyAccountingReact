import type { CategoryLimit } from '@/types/categoryLimits';
import type { CategoryResponse } from '@/types/categories';

export const makeLimit = (
  overrides: Partial<CategoryLimit> = {}
): CategoryLimit => ({
  id: 'l1',
  category_id: 'c1',
  category_name: 'Food',
  category_archived: false,
  period_type: 'MONTHLY',
  amount: 300,
  currency: 'EUR',
  effective_from: '2026-11-01',
  effective_to: null,
  ...overrides,
});

export const makeCategory = (id: string, name: string): CategoryResponse => ({
  id,
  name,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});
