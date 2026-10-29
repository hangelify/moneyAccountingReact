import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  firstNameSchema,
} from './validation-schemas';

const base = {
  email: 'a@b.co',
  password: 'correct-horse-battery',
  first_name: 'Ann',
};

describe('registerSchema', () => {
  it('accepts a password without uppercase or symbol', () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a 7-character password', () => {
    expect(
      registerSchema.safeParse({ ...base, password: 'abcdefg' }).success
    ).toBe(false);
  });

  it('accepts 24 x ж (48 bytes)', () => {
    expect(
      registerSchema.safeParse({ ...base, password: 'ж'.repeat(24) }).success
    ).toBe(true);
  });

  it('accepts 36 x ж (72 bytes exactly)', () => {
    expect(
      registerSchema.safeParse({ ...base, password: 'ж'.repeat(36) }).success
    ).toBe(true);
  });

  it('rejects 37 x ж (74 bytes)', () => {
    expect(
      registerSchema.safeParse({ ...base, password: 'ж'.repeat(37) }).success
    ).toBe(false);
  });

  it('rejects a last_name of 256 characters', () => {
    expect(
      registerSchema.safeParse({ ...base, last_name: 'a'.repeat(256) }).success
    ).toBe(false);
  });

  it('accepts an undefined last_name', () => {
    expect(
      registerSchema.safeParse({ ...base, last_name: undefined }).success
    ).toBe(true);
  });
});

describe('firstNameSchema', () => {
  it('accepts a single character', () => {
    expect(firstNameSchema.safeParse('A').success).toBe(true);
  });

  it('rejects whitespace only', () => {
    expect(firstNameSchema.safeParse('   ').success).toBe(false);
  });

  it('rejects 256 characters', () => {
    expect(firstNameSchema.safeParse('a'.repeat(256)).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts any non-empty password', () => {
    expect(
      loginSchema.safeParse({ email: 'a@b.co', password: 'abc' }).success
    ).toBe(true);
  });
});
