import { useEffect, useState, type ReactElement } from 'react';
import { Bell, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useActiveHouseholdId } from '@/contexts/HouseholdContext';
import { useTrackedBatches } from '@/hooks/useBillBatch';
import { useBillBatchStore } from '@/stores/billBatchStore';
import { BatchItemRow } from '@/components/header/BatchItemRow';

type Entry = ReturnType<typeof useTrackedBatches>[number];

function BatchSection({
  entry,
  onDismiss,
}: {
  entry: Entry;
  onDismiss: (batchId: string) => void;
}): ReactElement {
  const { t } = useTranslation('header');
  const { t: tc } = useTranslation('common');
  const { tracked, query } = entry;
  const batch = query.data;

  if (!batch) {
    return (
      <div className="flex items-center justify-between px-2 py-2 text-sm">
        {query.isError ? (
          <>
            <span className="text-destructive">{t('batches.loadFailed')}</span>
            <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void query.refetch()}
              >
                {tc('actions.retry')}
              </Button>
            </DropdownMenuItem>
          </>
        ) : (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
      </div>
    );
  }

  const done = batch.items.filter((i) => i.status === 'done').length;
  const failed = batch.items.filter((i) => i.status === 'failed').length;
  const pending = batch.items.filter(
    (i) => i.status === 'queued' || i.status === 'processing'
  ).length;
  const pct = batch.total > 0 ? ((done + failed) / batch.total) * 100 : 0;
  const items = [...batch.items].sort((a, b) => a.position - b.position);

  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-2 px-2">
        <span className="text-xs font-medium">
          {t('batches.summary', { total: batch.total, done, failed, pending })}
        </span>
        {batch.completed && (
          <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label={t('batches.dismiss')}
              onClick={() => onDismiss(tracked.batchId)}
            >
              <X className="h-3 w-3" />
            </Button>
          </DropdownMenuItem>
        )}
      </div>
      <div className="mx-2 mt-1 h-1 overflow-hidden rounded bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      {items.map((item) => (
        <BatchItemRow
          key={item.id}
          item={item}
          thumbnail={tracked.thumbnails[item.position]}
          waiting={tracked.waiting.includes(item.position)}
        />
      ))}
    </div>
  );
}

export function BatchBell(): ReactElement | null {
  const { t } = useTranslation('header');
  const hid = useActiveHouseholdId();
  const entries = useTrackedBatches(hid);
  const markAllSeen = useBillBatchStore((s) => s.markAllSeen);
  const dismiss = useBillBatchStore((s) => s.dismiss);
  const dismissCompleted = useBillBatchStore((s) => s.dismissCompleted);

  const count = entries.length;
  const [prevCount, setPrevCount] = useState(count);
  const [pulse, setPulse] = useState(false);

  if (count !== prevCount) {
    setPrevCount(count);
    if (count > prevCount) setPulse(true);
  }

  useEffect(() => {
    if (!pulse) return undefined;
    const timer = setTimeout(() => setPulse(false), 1000);
    return () => clearTimeout(timer);
  }, [pulse]);

  if (count === 0 || !hid) return null;

  const running = entries.some(
    (e) => !e.query.isError && e.query.data?.completed !== true
  );
  const unseen = entries.filter((e) => e.tracked.unseen).length;
  const completedIds = entries
    .filter((e) => e.query.data?.completed === true)
    .map((e) => e.tracked.batchId);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) markAllSeen(hid);
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative ${pulse ? 'animate-pulse' : ''}`}
          aria-label={t('batches.open')}
        >
          <Bell className="h-5 w-5" />
          {running ? (
            <Loader2 className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            unseen > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                {unseen}
              </span>
            )
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[22.5rem] max-w-[calc(100vw-2rem)]"
      >
        <div className="max-h-[60vh] overflow-y-auto">
          {entries.map((entry) => (
            <BatchSection
              key={entry.tracked.batchId}
              entry={entry}
              onDismiss={dismiss}
            />
          ))}
        </div>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between">
          <DropdownMenuItem asChild>
            <Link to="/bills/drafts">{t('batches.viewDrafts')}</Link>
          </DropdownMenuItem>
          {completedIds.length > 0 && (
            <DropdownMenuItem
              onClick={() => dismissCompleted(hid, completedIds)}
            >
              {t('batches.clearFinished')}
            </DropdownMenuItem>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
