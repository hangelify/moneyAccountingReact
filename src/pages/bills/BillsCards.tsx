import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { BillsListPage } from './BillsListPage';
import { BillCardGrid } from './components/BillCardGrid';

export function BillsCards(): ReactElement {
  const { t } = useTranslation('bills');
  return (
    <BillsListPage
      title={t('cards.title')}
      renderBills={(bills, openBill) => (
        <BillCardGrid bills={bills} onCardClick={openBill} />
      )}
    />
  );
}
