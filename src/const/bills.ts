export const BILLS_ENDPOINTS = {
  PARSE_PHOTO: '/bills/parse-photo',
  LIST: '/bills',
  DRAFTS: '/bills/drafts',
  DETAIL: (id: string): string => `/bills/${id}`,
  CONFIRM: (id: string): string => `/bills/${id}/confirm`,
  MARK_DUPLICATE: (id: string): string => `/bills/${id}/mark-duplicate`,
  UNMARK_DUPLICATE: (id: string): string => `/bills/${id}/unmark-duplicate`,
  DISMISS_DUPLICATE: (id: string): string => `/bills/${id}/dismiss-duplicate`,
  DUPLICATE_SUGGESTIONS: '/bills/duplicate-suggestions',
} as const;

export const BILL_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type BillImageMime = (typeof BILL_IMAGE_MIME_TYPES)[number];

export const BILL_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
