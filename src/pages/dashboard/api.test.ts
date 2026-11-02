import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { ApiError } from '@/auth/apiError';
import type { SpendingBreakdown } from '@/types/dashboard';
import { dashboardApi } from './api';

const URL = '/households/hh-1/bills/dashboard/spending-breakdown';

const body: SpendingBreakdown = {
  range: { period: 'month', start: '2026-10-01', end: '2026-11-01' },
  by_currency: [],
};

describe('dashboardApi.spendingBreakdown', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  it('GETs month params with anchor', async () => {
    mock
      .onGet(URL, { params: { period: 'month', anchor: '2026-10-31' } })
      .reply(200, body);

    const result = await dashboardApi.spendingBreakdown('hh-1', {
      period: 'month',
      anchor: '2026-10-31',
    });

    expect(result).toEqual(body);
  });

  it('sends from/to and no anchor for custom', async () => {
    mock.onGet(URL).reply(200, body);

    await dashboardApi.spendingBreakdown('hh-1', {
      period: 'custom',
      from: '2026-03-05',
      to: '2026-03-20',
    });

    expect(mock.history.get[0]!.params).toEqual({
      period: 'custom',
      from: '2026-03-05',
      to: '2026-03-20',
    });
  });

  it('maps 500 to ApiError', async () => {
    mock.onGet(URL).reply(500, { message: 'Internal server error' });
    await expect(
      dashboardApi.spendingBreakdown('hh-1', {
        period: 'month',
        anchor: '2026-10-31',
      })
    ).rejects.toBeInstanceOf(ApiError);
  });
});
