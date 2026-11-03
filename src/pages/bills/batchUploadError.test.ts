import { describe, expect, it } from 'vitest';
import { ApiError } from '../../auth/apiError';
import { fileIndexFromMessage, toBatchUploadFailure } from './batchUploadError';

const body = (message: string, extra: Record<string, unknown> = {}) => ({
  statusCode: 0,
  error: 'x',
  message,
  request_id: null,
  ...extra,
});

describe('fileIndexFromMessage', () => {
  it('turns a 1-based "File N:" into a 0-based index', () => {
    expect(fileIndexFromMessage('File 3: bad')).toBe(2);
  });
  it('returns null without a match', () => {
    expect(fileIndexFromMessage('Too large')).toBeNull();
    expect(fileIndexFromMessage('File 0: x')).toBeNull();
  });
});

describe('toBatchUploadFailure', () => {
  it('400 with File 2 is bad-file index 1', () => {
    expect(
      toBatchUploadFailure(
        new ApiError(400, body('File 2: The image could not be decoded'))
      )
    ).toEqual({
      kind: 'bad-file',
      fileIndex: 1,
      message: 'File 2: The image could not be decoded',
    });
  });
  it('415 with File 1 is index 0', () => {
    expect(
      toBatchUploadFailure(new ApiError(415, body('File 1: Unsupported type')))
    ).toMatchObject({ kind: 'bad-file', fileIndex: 0 });
  });
  it('413 without File has null index', () => {
    expect(toBatchUploadFailure(new ApiError(413, body('Too large')))).toEqual({
      kind: 'bad-file',
      fileIndex: null,
      message: 'Too large',
    });
  });
  it('429 uses Retry-After header', () => {
    expect(
      toBatchUploadFailure(
        new ApiError(429, body('Slow'), { 'retry-after': '40' })
      )
    ).toEqual({ kind: 'retry-later', message: 'Slow', retryAfterSec: 40 });
  });
  it('429 reads seconds from the message', () => {
    expect(
      toBatchUploadFailure(new ApiError(429, body('Try again in 12 s')))
    ).toMatchObject({ kind: 'retry-later', retryAfterSec: 12 });
  });
  it('429 daily budget is budget', () => {
    expect(
      toBatchUploadFailure(
        new ApiError(429, body('Daily AI budget exceeded today'), {
          'retry-after': '60',
        })
      )
    ).toEqual({ kind: 'budget', message: 'Daily AI budget exceeded today' });
  });
  it('503 disabled', () => {
    expect(
      toBatchUploadFailure(
        new ApiError(503, body('Batch photo parsing is disabled'))
      )
    ).toEqual({
      kind: 'disabled',
      message: 'Batch photo parsing is disabled',
    });
  });
  it('503 with Retry-After is busy', () => {
    expect(
      toBatchUploadFailure(
        new ApiError(503, body('Busy'), { 'retry-after': '5' })
      )
    ).toEqual({ kind: 'busy', message: 'Busy', retryAfterSec: 5 });
  });
  it('503 without header defaults to 30', () => {
    expect(toBatchUploadFailure(new ApiError(503, body('Busy')))).toMatchObject(
      { kind: 'busy', retryAfterSec: 30 }
    );
  });
  it('401 auth, 403 forbidden', () => {
    expect(toBatchUploadFailure(new ApiError(401, body('x')))).toEqual({
      kind: 'auth',
    });
    expect(toBatchUploadFailure(new ApiError(403, body('x')))).toEqual({
      kind: 'forbidden',
    });
  });
  it('ERR_CANCELED is cancelled', () => {
    const err = new ApiError(undefined, undefined, {}, 'canceled', {
      code: 'ERR_CANCELED',
    });
    expect(toBatchUploadFailure(err)).toEqual({ kind: 'cancelled' });
  });
  it('ECONNABORTED is a timeout', () => {
    const err = new ApiError(undefined, undefined, {}, 'timeout', {
      code: 'ECONNABORTED',
    });
    expect(toBatchUploadFailure(err)).toEqual({
      kind: 'failed',
      message: 'timeout',
      requestId: null,
      timedOut: true,
    });
  });
  it('502 carries request_id; non-ApiError fails', () => {
    expect(
      toBatchUploadFailure(new ApiError(502, body('Up', { request_id: 'r2' })))
    ).toEqual({
      kind: 'failed',
      message: 'Up',
      requestId: 'r2',
      timedOut: false,
    });
    expect(toBatchUploadFailure(new Error('boom'))).toEqual({
      kind: 'failed',
      message: 'boom',
      requestId: null,
      timedOut: false,
    });
  });
});
