// src/pages/bills/BillDetailRoute.tsx
import type { ReactElement } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoadingFallback } from '@/components/common/LoadingFallback';
import { billDetailParent } from '@/lib/billDetailParent';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { BillDetailDrawer } from './BillDetailDrawer';
import { BillDetailPage } from './BillDetailPage';
import { useBillLinkHousehold } from './useBillLinkHousehold';

function BillInaccessible(): ReactElement {
  const { t } = useTranslation(['households', 'bills']);
  const { pathname } = useLocation();
  return (
    <div className="space-y-2 px-4 py-6">
      <p role="alert">{t('households:billInaccessible')}</p>
      <Link
        to={billDetailParent(pathname) ?? '/bills'}
        className="text-sm underline underline-offset-4"
      >
        {t('bills:confirmed.detail.back')}
      </Link>
    </div>
  );
}

// Element of the nested bills/:id routes: a full page on desktop, the
// drawer over the list on mobile. A link's budget is applied first.
export function BillDetailRoute(): ReactElement | null {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const linkState = useBillLinkHousehold();
  if (linkState === 'pending') return <LoadingFallback />;
  if (linkState === 'inaccessible') return <BillInaccessible />;
  return isDesktop ? <BillDetailPage /> : <BillDetailDrawer />;
}
