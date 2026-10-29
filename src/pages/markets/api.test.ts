import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { marketsApi } from './api';

describe('marketsApi.list', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  it('GETs /markets and returns the list verbatim', async () => {
    mock.onGet('/markets').reply(200, [
      {
        id: '1',
        name: 'Lidl',
        address: null,
        city: 'Bucharest',
        country: 'RO',
        created_at: '2026-01-10T08:00:00.000Z',
        bill_count: 12,
      },
      {
        id: '2',
        name: 'Kaufland',
        address: null,
        city: null,
        country: null,
        created_at: '2026-02-01T08:00:00.000Z',
        bill_count: 3,
      },
    ]);
    const r = await marketsApi.list();
    expect(r).toHaveLength(2);
    expect(r[0]?.name).toBe('Lidl');
    expect(r[1]?.bill_count).toBe(3);
  });
});
