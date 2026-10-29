import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { ApiError } from '@/auth/apiError';
import { billsApi } from './api';
import type { ConfirmedBillsFilters } from './buildBillsQueryParams';

describe('billsApi.parsePhoto', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });

  afterEach(() => {
    mock.restore();
  });

  function makeFile(): File {
    return new File(['hello'], 'receipt.jpg', { type: 'image/jpeg' });
  }

  it('POSTs multipart/form-data with an "image" field to /bills/parse-photo', async () => {
    mock.onPost('/bills/parse-photo').reply((config) => {
      const body = config.data as FormData;
      expect(body).toBeInstanceOf(FormData);
      expect(body.get('image')).toBeInstanceOf(File);
      expect((body.get('image') as File).name).toBe('receipt.jpg');
      // axios should let the browser set the Content-Type with a boundary.
      // We assert we did NOT override it to plain 'application/json'.
      const contentType = (config.headers?.['Content-Type'] ??
        config.headers?.['content-type']) as string | undefined;
      expect(contentType === 'application/json').toBe(false);
      return [
        200,
        {
          market_name: 'Lidl',
          bill_date: '2026-05-07',
          currency: 'EUR',
          total_amount: 23.45,
          items: [],
          raw_extracted_text: 'LIDL',
        },
      ];
    });

    const result = await billsApi.parsePhoto(makeFile());

    expect(result.market_name).toBe('Lidl');
    expect(result.items).toEqual([]);
  });

  it('maps 400 responses to ApiError with the server message', async () => {
    mock.onPost('/bills/parse-photo').reply(400, {
      message: 'File too large',
      statusCode: 400,
    });

    await expect(billsApi.parsePhoto(makeFile())).rejects.toMatchObject({
      status: 400,
      message: 'File too large',
    });
    await expect(billsApi.parsePhoto(makeFile())).rejects.toBeInstanceOf(
      ApiError
    );
  });

  it('maps 502 responses to ApiError and exposes the requestId in body', async () => {
    mock.onPost('/bills/parse-photo').reply(502, {
      message: 'AI providers failed',
      requestId: 'req-abc-123',
    });

    await expect(billsApi.parsePhoto(makeFile())).rejects.toMatchObject({
      status: 502,
      body: { requestId: 'req-abc-123' },
    });
  });
});

describe('billsApi.list', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  const empty: ConfirmedBillsFilters = {
    date_from: null,
    date_to: null,
    market_names: [],
    amount_min: null,
    amount_max: null,
    currency: null,
  };

  it('GETs /bills with default page=1 and limit=20', async () => {
    mock.onGet('/bills').reply((config) => {
      expect(config.params).toMatchObject({ page: '1', limit: '20' });
      return [
        200,
        { data: [], meta: { total: 0, page: 1, limit: 20, total_pages: 0 } },
      ];
    });
    const r = await billsApi.list(empty, 1, 20);
    expect(r.data).toEqual([]);
  });

  it('serializes every filter into request params', async () => {
    mock.onGet('/bills').reply((config) => {
      expect(config.params).toMatchObject({
        date_from: '2026-01-01',
        date_to: '2026-06-30',
        market_names: ['Lidl', 'Kaufland'],
        amount_range: 'gt_100,lt_500',
        currency: 'EUR',
        page: '2',
        limit: '20',
      });
      return [
        200,
        { data: [], meta: { total: 0, page: 2, limit: 20, total_pages: 0 } },
      ];
    });
    await billsApi.list(
      {
        date_from: '2026-01-01',
        date_to: '2026-06-30',
        market_names: ['Lidl', 'Kaufland'],
        amount_min: 100,
        amount_max: 500,
        currency: 'EUR',
      },
      2,
      20
    );
  });

  it('serializes market_names as repeated keys in the URL', async () => {
    mock.onGet('/bills').reply((config) => {
      // Axios 1.x normalises a plain function to { serialize: fn }, so we
      // unwrap accordingly. Fall back to empty string if absent.
      const serializer = config.paramsSerializer;
      const serializeFn =
        typeof serializer === 'function'
          ? serializer
          : typeof serializer === 'object' && serializer !== null
            ? (serializer as { serialize: (p: unknown) => string }).serialize
            : null;
      const url = serializeFn
        ? serializeFn(config.params as Record<string, unknown>)
        : '';
      expect(url).toContain('market_names=Lidl');
      expect(url).toContain('market_names=Kaufland');
      return [
        200,
        { data: [], meta: { total: 0, page: 1, limit: 20, total_pages: 0 } },
      ];
    });
    await billsApi.list(
      { ...empty, market_names: ['Lidl', 'Kaufland'] },
      1,
      20
    );
  });
});

describe('billsApi.detail', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  it('GETs /bills/:id and returns BillDetailResponseDto', async () => {
    mock.onGet('/bills/abc-123').reply(200, {
      id: 'abc-123',
      bill_date: '2026-05-19T00:00:00Z',
      total_amount: 52.3,
      currency: 'EUR',
      description: null,
      market: { id: 'm1', name: 'Lidl', city: 'Bucharest' },
      created_at: '2026-05-19T10:00:00Z',
      items: [],
    });
    const r = await billsApi.detail('abc-123');
    expect(r.id).toBe('abc-123');
    expect(r.items).toEqual([]);
  });

  it('throws ApiError on 404', async () => {
    mock.onGet('/bills/missing').reply(404, { message: 'Bill not found' });
    await expect(billsApi.detail('missing')).rejects.toBeInstanceOf(ApiError);
    await expect(billsApi.detail('missing')).rejects.toMatchObject({
      status: 404,
      message: 'Bill not found',
    });
  });
});
