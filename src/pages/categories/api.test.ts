import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { ApiError } from '@/auth/apiError';
import { subCategoriesApi } from './api';

describe('subCategoriesApi.list', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  it('GETs /sub-categories and returns the array', async () => {
    mock.onGet('/sub-categories').reply(200, [
      {
        id: 'a',
        name: 'milk',
        category_id: 'c1',
        category_name: 'Dairy',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const result = await subCategoriesApi.list();

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('milk');
    expect(result[0]!.category_name).toBe('Dairy');
  });

  it('maps 401 responses to ApiError', async () => {
    mock.onGet('/sub-categories').reply(401, { message: 'Unauthorized' });
    await expect(subCategoriesApi.list()).rejects.toBeInstanceOf(ApiError);
  });
});
