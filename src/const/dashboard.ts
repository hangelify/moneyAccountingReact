export const DASHBOARD_ENDPOINTS = {
  SPENDING_BREAKDOWN: '/bills/dashboard/spending-breakdown',
} as const;

export const SPENDING_PERIODS = [
  'week',
  'month',
  'quarter',
  'year',
  '5y',
  'custom',
] as const;
