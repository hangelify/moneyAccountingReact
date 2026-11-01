import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { householdsApi } from './api';

describe('householdsApi.list', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  it('sorts by created_at then name', async () => {
    mock.onGet('/households').reply(200, [
      {
        id: 'b',
        name: 'B',
        created_at: '2026-09-14T08:31:12.000Z',
        member_count: 1,
      },
      {
        id: 'z',
        name: 'Zed',
        created_at: '2026-06-03T12:00:00.000Z',
        member_count: 2,
      },
      {
        id: 'a',
        name: 'Alpha',
        created_at: '2026-06-03T12:00:00.000Z',
        member_count: 3,
      },
    ]);
    const r = await householdsApi.list();
    expect(r.map((h) => h.id)).toEqual(['a', 'z', 'b']);
  });
});

describe('householdsApi.update', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  it('PUTs the given fields and returns the household', async () => {
    const saved = {
      id: 'hh 1',
      name: 'Family',
      currency: 'MDL',
      created_at: '2026-06-03T12:00:00.000Z',
      member_count: 2,
    };
    mock.onPut('/households/hh%201').reply(200, saved);
    const h = await householdsApi.update('hh 1', { currency: 'MDL' });
    expect(JSON.parse(mock.history.put[0]?.data as string)).toEqual({
      currency: 'MDL',
    });
    expect(h).toEqual(saved);
  });
});
