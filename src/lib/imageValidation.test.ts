import { describe, it, expect } from 'vitest';
import { validateBillImage } from './imageValidation';

function makeFile(name: string, type: string, size: number): File {
  const file = new File([new Uint8Array(Math.min(size, 1))], name, { type });
  // Override size (File size is bytes of content; we need bigger)
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('validateBillImage', () => {
  it('accepts a valid JPEG under the size limit', () => {
    const file = makeFile('receipt.jpg', 'image/jpeg', 1024);
    expect(validateBillImage(file)).toEqual({ ok: true });
  });

  it('accepts a valid PNG', () => {
    const file = makeFile('receipt.png', 'image/png', 1024);
    expect(validateBillImage(file)).toEqual({ ok: true });
  });

  it('accepts a valid WEBP', () => {
    const file = makeFile('receipt.webp', 'image/webp', 1024);
    expect(validateBillImage(file)).toEqual({ ok: true });
  });

  it('rejects unsupported MIME', () => {
    const file = makeFile('receipt.gif', 'image/gif', 1024);
    expect(validateBillImage(file)).toEqual({
      ok: false,
      reason: 'unsupported_format',
    });
  });

  it('rejects files over 10 MB', () => {
    const file = makeFile('receipt.jpg', 'image/jpeg', 10 * 1024 * 1024 + 1);
    expect(validateBillImage(file)).toEqual({
      ok: false,
      reason: 'file_too_large',
    });
  });

  it('accepts files exactly at the 10 MB limit', () => {
    const file = makeFile('receipt.jpg', 'image/jpeg', 10 * 1024 * 1024);
    expect(validateBillImage(file)).toEqual({ ok: true });
  });
});
