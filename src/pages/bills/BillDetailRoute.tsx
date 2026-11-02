// src/pages/bills/BillDetailRoute.tsx
import type { ReactElement } from 'react';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { BillDetailDrawer } from './BillDetailDrawer';
import { BillDetailPage } from './BillDetailPage';

// Element of the nested bills/:id routes: a full page on desktop, the
// drawer over the list on mobile.
export function BillDetailRoute(): ReactElement | null {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  return isDesktop ? <BillDetailPage /> : <BillDetailDrawer />;
}
