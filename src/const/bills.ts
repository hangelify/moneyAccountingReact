export const BILLS_ENDPOINTS = {
  PARSE_PHOTO: '/bills/parse-photo',
  PARSE_PHOTOS: '/bills/parse-photos',
  EVENTS: '/bills/events',
  BATCH: (id: string): string => `/bill-batches/${id}`,
  RETRY: (id: string): string => `/bills/${id}/retry`,
  DRAFT_IMAGE: (id: string): string => `/bills/drafts/${id}/image`,
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

// Batch photo upload: 2 to 20 photos; one photo uses the parse-photo flow.
export const BATCH_MAX_FILES = 20;
export const RESIZE_MAX_BYTES = 2.5 * 1024 * 1024;
export const RESIZE_MAX_SIDE = 3000;
export const RESIZE_JPEG_QUALITY = 0.85;
