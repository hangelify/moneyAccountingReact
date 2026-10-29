import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { BillsListPage } from './BillsListPage';
import { ConfirmedBillsTable } from './components/ConfirmedBillsTable';

export function ConfirmedBills(): ReactElement {
  const { t } = useTranslation('bills');
  return (
    <BillsListPage
      title={t('confirmed.title')}
      renderBills={(bills, openBill) => (
        <ConfirmedBillsTable bills={bills} onRowClick={openBill} />
      )}
    />
  );
}
