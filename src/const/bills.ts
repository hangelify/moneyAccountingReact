export const BILLS_ENDPOINTS = {
  PARSE_PHOTO: '/bills/parse-photo',
  LIST: '/bills',
  DETAIL: (id: string): string => `/bills/${id}`,
} as const;

export const BILL_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type BillImageMime = (typeof BILL_IMAGE_MIME_TYPES)[number];

export const BILL_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
