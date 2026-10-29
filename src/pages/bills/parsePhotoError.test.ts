import { describe, expect, it } from 'vitest';
import { ApiError } from '../../auth/apiError';
import type { ParsedBill } from '../../types/bills';
import { toParsePhotoFailure } from './parsePhotoError';

const body = (message: string, extra: Record<string, unknown> = {}) => ({
  statusCode: 0,
  error: 'x',
  message,
  request_id: null,
  ...extra,
});

describe('toParsePhotoFailure', () => {
  it('maps a raw CanceledError / AbortError to cancelled', () => {
    for (const name of ['CanceledError', 'AbortError']) {
      const err = new Error('stop');
      err.name = name;
      expect(toParsePhotoFailure(err)).toEqual({ kind: 'cancelled' });
    }
  });

  it('maps ApiError with code ERR_CANCELED to cancelled', () => {
    const err = new ApiError(undefined, undefined, {}, 'canceled', {
      code: 'ERR_CANCELED',
    });
    expect(toParsePhotoFailure(err)).toEqual({ kind: 'cancelled' });
  });

  it('maps 401 to auth and 403 to forbidden', () => {
    expect(toParsePhotoFailure(new ApiError(401, body('no')))).toEqual({
      kind: 'auth',
    });
    expect(toParsePhotoFailure(new ApiError(403, body('no')))).toEqual({
      kind: 'forbidden',
    });
  });

  it.each([413, 415])(
    'maps %i to bad-photo with the server message',
    (status) => {
      expect(
        toParsePhotoFailure(new ApiError(status, body('Bad file')))
      ).toEqual({
        kind: 'bad-photo',
        message: 'Bad file',
      });
    }
  );

  describe('422', () => {
    it('request_id null is bad-photo', () => {
      expect(
        toParsePhotoFailure(new ApiError(422, body('Unreadable')))
      ).toEqual({
        kind: 'bad-photo',
        message: 'Unreadable',
      });
    });
    it('retake message is bad-photo', () => {
      expect(
        toParsePhotoFailure(new ApiError(422, body('Please retake the photo')))
      ).toEqual({
        kind: 'bad-photo',
        message: 'Please retake the photo',
      });
    });
    it('not a receipt is bad-photo', () => {
      expect(
        toParsePhotoFailure(
          new ApiError(
            422,
            body('The photo is not a receipt', { request_id: 'r9' })
          )
        )
      ).toEqual({ kind: 'bad-photo', message: 'The photo is not a receipt' });
    });
    it('body with parsed is save-failed', () => {
      const parsed = { items: [] } as unknown as ParsedBill;
      expect(
        toParsePhotoFailure(
          new ApiError(
            422,
            body('Could not save', { request_id: 'r1', parsed })
          )
        )
      ).toEqual({ kind: 'save-failed', parsed, requestId: 'r1' });
    });
  });

  describe('retry-later / unavailable', () => {
    it('429 uses the Retry-After header', () => {
      const err = new ApiError(429, body('Slow down'), { 'retry-after': '12' });
      expect(toParsePhotoFailure(err)).toEqual({
        kind: 'retry-later',
        message: 'Slow down',
        retryAfterSec: 12,
      });
    });
    it('429 without header reads seconds from the message', () => {
      const err = new ApiError(
        429,
        body('Too many requests. Try again in 41 s')
      );
      expect(toParsePhotoFailure(err)).toMatchObject({
        kind: 'retry-later',
        retryAfterSec: 41,
      });
    });
    it('503 without header and unrelated message defaults to 30', () => {
      expect(
        toParsePhotoFailure(new ApiError(503, body('Busy')))
      ).toMatchObject({
        kind: 'retry-later',
        retryAfterSec: 30,
      });
    });
    it('falls back when Retry-After is an HTTP date', () => {
      const err = new ApiError(503, body('Busy'), {
        'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT',
      });
      expect(toParsePhotoFailure(err)).toMatchObject({
        kind: 'retry-later',
        retryAfterSec: 30,
      });
    });
    it('503 "Photo recognition is not available" is unavailable', () => {
      expect(
        toParsePhotoFailure(
          new ApiError(503, body('Photo recognition is not available'))
        )
      ).toEqual({
        kind: 'unavailable',
        message: 'Photo recognition is not available',
      });
    });
    it('429 daily budget is unavailable even with a Retry-After header', () => {
      const err = new ApiError(
        429,
        body('Daily AI budget exceeded for today'),
        {
          'retry-after': '60',
        }
      );
      expect(toParsePhotoFailure(err)).toEqual({
        kind: 'unavailable',
        message: 'Daily AI budget exceeded for today',
      });
    });
  });

  describe('failed', () => {
    it('502 carries request_id', () => {
      expect(
        toParsePhotoFailure(
          new ApiError(502, body('Upstream', { request_id: 'r2' }))
        )
      ).toEqual({
        kind: 'failed',
        message: 'Upstream',
        requestId: 'r2',
        timedOut: false,
      });
    });
    it('ECONNABORTED is a timeout', () => {
      const err = new ApiError(undefined, undefined, {}, 'timeout', {
        code: 'ECONNABORTED',
      });
      expect(toParsePhotoFailure(err)).toEqual({
        kind: 'failed',
        message: 'timeout',
        requestId: null,
        timedOut: true,
      });
    });
    it('other network error is not a timeout', () => {
      const err = new ApiError(undefined, undefined, {}, 'Network Error', {
        code: 'ERR_NETWORK',
      });
      expect(toParsePhotoFailure(err)).toMatchObject({
        kind: 'failed',
        timedOut: false,
        requestId: null,
      });
    });
    it('non-ApiError becomes failed', () => {
      expect(toParsePhotoFailure(new Error('boom'))).toEqual({
        kind: 'failed',
        message: 'boom',
        requestId: null,
        timedOut: false,
      });
    });
  });
});
