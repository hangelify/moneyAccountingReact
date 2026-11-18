export const CATEGORY_LIMITS_ENDPOINTS = {
  LIST: '/category-limits',
  ONE: (categoryId: string): string => `/category-limits/${categoryId}`,
} as const;
