import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { BillBatchItem } from '@/types/bills';
import type { ReactElement } from 'react';

interface BatchItemRowProps {
  item: BillBatchItem;
  thumbnail?: string | undefined;
  waiting: boolean;
}

export function BatchItemRow({
  item,
  thumbnail,
  waiting,
}: BatchItemRowProps): ReactElement {
  const { t } = useTranslation('header');
  const n = item.position + 1;
  const chipKey = item.status === 'queued' && waiting ? 'waiting' : item.status;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          className="h-8 w-8 shrink-0 rounded object-cover"
        />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
          {n}
        </span>
      )}
      <span className="shrink-0">{t('batches.photo', { n })}</span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
        {item.status === 'processing' && (
          <Loader2 className="h-3 w-3 animate-spin" />
        )}
        {t(`batches.chips.${chipKey}`)}
      </span>
      <span className="ml-auto flex min-w-0 items-center gap-2">
        {item.status === 'failed' && item.parse_error_message && (
          <span
            className="min-w-0 truncate text-xs text-muted-foreground"
            title={item.parse_error_message}
          >
            {item.parse_error_message}
          </span>
        )}
        {item.status === 'done' && item.bill_id && (
          <DropdownMenuItem asChild className="shrink-0 py-0.5">
            <Link to={`/bills/drafts/${item.bill_id}`}>
              {t('batches.review')}
            </Link>
          </DropdownMenuItem>
        )}
        {item.status === 'failed' && (
          <DropdownMenuItem asChild className="shrink-0 py-0.5">
            <Link to="/bills/drafts#failed">{t('batches.openFailed')}</Link>
          </DropdownMenuItem>
        )}
      </span>
    </div>
  );
}
