import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { householdsApi } from './households';

describe('householdsApi.list', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  it('keeps server order', async () => {
    mock.onGet('/households').reply(200, [
      {
        id: 'b',
        name: 'B',
        created_at: '2026-09-14T08:31:12.000Z',
        member_count: 1,
      },
      {
        id: 'a',
        name: 'Alpha',
        created_at: '2026-06-03T12:00:00.000Z',
        member_count: 3,
      },
    ]);
    const r = await householdsApi.list();
    expect(r.map((h) => h.id)).toEqual(['b', 'a']);
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

describe('householdsApi create, updateMine, remove', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  it('create posts to /households', async () => {
    const created = { id: 'hh-9', name: 'New', currency: 'EUR' };
    mock.onPost('/households').reply(201, created);
    const h = await householdsApi.create({ name: 'New', currency: 'EUR' });
    expect(JSON.parse(mock.history.post[0]?.data as string)).toEqual({
      name: 'New',
      currency: 'EUR',
    });
    expect(h).toEqual(created);
  });

  it('updateMine puts to /households/hh-1/me with display_name null', async () => {
    mock.onPut('/households/hh-1/me').reply(200, { id: 'hh-1' });
    await householdsApi.updateMine('hh-1', { display_name: null });
    expect(JSON.parse(mock.history.put[0]?.data as string)).toEqual({
      display_name: null,
    });
  });

  it('remove deletes /households/hh-1', async () => {
    mock.onDelete('/households/hh-1').reply(204);
    await householdsApi.remove('hh-1');
    expect(mock.history.delete).toHaveLength(1);
  });
});
