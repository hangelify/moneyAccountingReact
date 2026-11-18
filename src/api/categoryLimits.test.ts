import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { ApiError } from '@/auth/apiError';
import type { CategoryLimit } from '@/types/categoryLimits';
import { categoryLimitsApi } from './categoryLimits';

const limit = (overrides: Partial<CategoryLimit> = {}): CategoryLimit => ({
  id: 'l1',
  category_id: 'c1',
  category_name: 'Food',
  category_archived: false,
  period_type: 'MONTHLY',
  amount: 400,
  currency: 'EUR',
  effective_from: '2026-11-01',
  effective_to: null,
  ...overrides,
});

describe('categoryLimitsApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  it('list GETs the household limits', async () => {
    mock.onGet('/households/hh-1/category-limits').reply(200, [limit()]);
    await expect(categoryLimitsApi.list('hh-1')).resolves.toEqual([limit()]);
  });

  it('create POSTs category, period and amount', async () => {
    mock.onPost('/households/hh-1/category-limits').reply(201, limit());
    const saved = await categoryLimitsApi.create('hh-1', {
      category_id: 'c1',
      period_type: 'MONTHLY',
      amount: 400,
    });
    expect(saved).toEqual(limit());
    expect(JSON.parse(String(mock.history.post[0]?.data))).toEqual({
      category_id: 'c1',
      period_type: 'MONTHLY',
      amount: 400,
    });
  });

  it('update PUTs period and amount to the category', async () => {
    const quarterly = limit({ period_type: 'QUARTERLY', amount: 1000 });
    mock.onPut('/households/hh-1/category-limits/c1').reply(200, quarterly);
    const saved = await categoryLimitsApi.update('hh-1', 'c1', {
      period_type: 'QUARTERLY',
      amount: 1000,
    });
    expect(saved).toEqual(quarterly);
    expect(JSON.parse(String(mock.history.put[0]?.data))).toEqual({
      period_type: 'QUARTERLY',
      amount: 1000,
    });
  });

  it('remove DELETEs the category limit and returns its end date', async () => {
    const ending = limit({ effective_to: '2026-12-01' });
    mock.onDelete('/households/hh-1/category-limits/c1').reply(200, ending);
    await expect(categoryLimitsApi.remove('hh-1', 'c1')).resolves.toEqual(
      ending
    );
  });

  it('rejects a conflict with ApiError 409', async () => {
    mock
      .onPost('/households/hh-1/category-limits')
      .reply(409, { message: 'Category already has a limit' });
    const error: unknown = await categoryLimitsApi
      .create('hh-1', { category_id: 'c1', period_type: 'MONTHLY', amount: 1 })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
  });
});
