import { describe, it, expect } from 'vitest';
import { ApiError } from './apiError';

describe('ApiError', () => {
  it('normalises a string message', () => {
    const e = new ApiError(401, { message: 'Invalid credentials' });
    expect(e.messages).toEqual(['Invalid credentials']);
    expect(e.message).toBe('Invalid credentials');
  });

  it('normalises a validation array', () => {
    const e = new ApiError(400, {
      message: [
        'email must be an email',
        'password must be longer than or equal to 8 characters',
      ],
    });
    expect(e.messages).toHaveLength(2);
    expect(e.fieldErrors()).toEqual({
      email: 'email must be an email',
      password: 'password must be longer than or equal to 8 characters',
    });
  });

  it('stores url and code from meta', () => {
    const e = new ApiError(403, {}, {}, undefined, {
      url: '/households/x/bills',
      code: 'ERR_BAD_REQUEST',
    });
    expect(e.url).toBe('/households/x/bills');
    expect(e.code).toBe('ERR_BAD_REQUEST');
    const bare = new ApiError(500, {});
    expect(bare.url).toBe('');
    expect(bare.code).toBeUndefined();
  });

  it('fieldErrors ignores non-field messages', () => {
    const e = new ApiError(409, { message: ['User already exists'] });
    expect(e.fieldErrors()).toEqual({});
  });

  it('retryAfterSeconds reads the header', () => {
    expect(
      new ApiError(429, {}, { 'retry-after': '120' }).retryAfterSeconds()
    ).toBe(120);
    expect(new ApiError(429, {}, {}).retryAfterSeconds()).toBeNull();
    expect(
      new ApiError(429, {}, { 'retry-after': 'abc' }).retryAfterSeconds()
    ).toBeNull();
  });

  it('falls back when body is empty', () => {
    const e = new ApiError(500, undefined, {}, 'Network Error');
    expect(e.message).toBe('Network Error');
  });
});
