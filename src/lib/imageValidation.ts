import {
  BILL_IMAGE_MAX_BYTES,
  BILL_IMAGE_MIME_TYPES,
  type BillImageMime,
} from '@/const/bills';

export type ValidationReason = 'unsupported_format' | 'file_too_large';

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: ValidationReason };

export function validateBillImage(file: File): ValidationResult {
  if (!(BILL_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: 'unsupported_format' };
  }
  if (file.size > BILL_IMAGE_MAX_BYTES) {
    return { ok: false, reason: 'file_too_large' };
  }
  return { ok: true };
}

export function isBillImageMime(mime: string): mime is BillImageMime {
  return (BILL_IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}
