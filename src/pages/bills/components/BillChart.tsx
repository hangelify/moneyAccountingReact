import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BillDetailResponseDto } from '@/types/bills';
import { ChartBreadcrumb } from '@/pages/dashboard/components/ChartBreadcrumb';
import { SpendingLegend } from '@/pages/dashboard/components/SpendingLegend';
import { SpendingSunburst } from '@/pages/dashboard/components/SpendingSunburst';
import { PALETTE_SIZE, categoryKey } from '@/pages/dashboard/sunburstGeometry';
import { billToSpending } from '../billToSpending';

export interface BillChartProps {
  bill: BillDetailResponseDto;
}

// The dashboard's spending sunburst for one bill. Unlike the dashboard, the
// zoom stays in state: the bill's URL belongs to the list and its drawer.
export function BillChart({ bill }: BillChartProps): ReactElement {
  const { t } = useTranslation('bills');
  const { t: tDashboard } = useTranslation('dashboard');
  const data = useMemo(() => billToSpending(bill), [bill]);
  const [zoomedKey, setZoomedKey] = useState<string | null>(null);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  if (data.categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('confirmed.detail.noItems')}
      </p>
    );
  }

  const zoomedIndex = data.categories.findIndex(
    (c) => categoryKey(c) === zoomedKey
  );
  const zoomed = data.categories[zoomedIndex];
  const zoom = (key: string | null): void => {
    setZoomedKey(key);
    setHighlightedKey(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <ChartBreadcrumb
        currency={data.currency}
        total={data.total}
        zoomed={
          zoomed
            ? {
                name:
                  zoomed.id === null
                    ? tDashboard('uncategorized')
                    : zoomed.name,
                look: {
                  colorIndex: zoomedIndex % PALETTE_SIZE,
                  tint: 0,
                  muted: false,
                  uncategorized: zoomed.id === null,
                },
                total: zoomed.total,
                share: zoomed.share,
              }
            : null
        }
        onBack={() => zoom(null)}
      />
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
        <div className="w-full md:w-1/2">
          <SpendingSunburst
            data={data}
            centreLabel={bill.bill_date.slice(0, 10)}
            zoomedKey={zoomed ? zoomedKey : null}
            onZoom={zoom}
            highlightedKey={highlightedKey}
            onHighlight={setHighlightedKey}
          />
        </div>
        <div className="w-full md:w-1/2">
          <SpendingLegend
            data={data}
            zoomedKey={zoomed ? zoomedKey : null}
            highlightedKey={highlightedKey}
            onZoom={zoom}
          />
        </div>
      </div>
    </div>
  );
}
