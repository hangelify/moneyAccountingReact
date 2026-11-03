import '@/i18n';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BatchBell } from './BatchBell';
import { HouseholdTestProvider, TEST_HID } from '@/test/household';
import {
  useBillBatchStore,
  __resetBillBatchStore,
} from '@/stores/billBatchStore';
import { batchKey } from '@/hooks/useBillBatch';
import type { BillBatch, BillBatchItem } from '@/types/bills';

const item = (
  position: number,
  status: BillBatchItem['status'],
  extra: Partial<BillBatchItem> = {}
): BillBatchItem => ({
  id: `i${position}`,
  position,
  status,
  bill_id: null,
  parse_error_code: null,
  parse_error_message: null,
  ...extra,
});

const makeBatch = (
  id: string,
  items: BillBatchItem[],
  completed = false
): BillBatch => ({
  batch_id: id,
  created_at: '2026-11-03T10:00:00Z',
  total: items.length,
  completed,
  items,
});

let queryClient: QueryClient;

function seed(batch: BillBatch, hid = TEST_HID): void {
  queryClient.setQueryData(batchKey(hid, batch.batch_id), batch);
  useBillBatchStore.getState().track(batch, hid, {});
}

function renderBell(): void {
  render(
    <QueryClientProvider client={queryClient}>
      <HouseholdTestProvider>
        <MemoryRouter>
          <BatchBell />
        </MemoryRouter>
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
}

async function open(): Promise<void> {
  await userEvent.click(
    screen.getByRole('button', { name: 'Upload progress' })
  );
}

beforeEach(() => {
  __resetBillBatchStore();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

describe('BatchBell', () => {
  it('renders nothing when no batch is tracked', () => {
    renderBell();
    expect(
      screen.queryByRole('button', { name: 'Upload progress' })
    ).toBeNull();
  });

  it('shows only batches of the active household', async () => {
    seed(
      makeBatch(
        'a',
        [
          item(0, 'done', { bill_id: 'b1' }),
          item(1, 'done', { bill_id: 'b2' }),
        ],
        true
      )
    );
    seed(
      makeBatch('other', [
        item(0, 'queued'),
        item(1, 'queued'),
        item(2, 'queued'),
      ]),
      'hh-2'
    );
    renderBell();
    await open();
    expect(await screen.findByText(/^2 photos/)).toBeInTheDocument();
    expect(screen.queryByText(/^3 photos/)).toBeNull();
  });

  it('trigger shows a spinner while a batch runs and the unseen count when all are done', () => {
    seed(makeBatch('run', [item(0, 'processing'), item(1, 'queued')]));
    renderBell();
    const trigger = screen.getByRole('button', { name: 'Upload progress' });
    expect(trigger.querySelector('.animate-spin')).not.toBeNull();
    expect(within(trigger).queryByText('1')).toBeNull();
  });

  it('shows the unseen count when all batches are done', () => {
    seed(
      makeBatch(
        'd',
        [item(0, 'done', { bill_id: 'b' }), item(1, 'failed')],
        true
      )
    );
    useBillBatchStore.getState().markUnseen('d');
    renderBell();
    const trigger = screen.getByRole('button', { name: 'Upload progress' });
    expect(trigger.querySelector('.animate-spin')).toBeNull();
    expect(within(trigger).getByText('1')).toBeInTheDocument();
  });

  it('opening marks all seen', async () => {
    seed(
      makeBatch(
        'd',
        [item(0, 'done', { bill_id: 'b' }), item(1, 'failed')],
        true
      )
    );
    useBillBatchStore.getState().markUnseen('d');
    renderBell();
    await open();
    expect(useBillBatchStore.getState().batches[0]?.unseen).toBe(false);
  });

  it('rows show Queued, Waiting (AI limit), Reading…, Draft ready, Failed by state', async () => {
    seed(
      makeBatch('r', [
        item(0, 'queued'),
        item(1, 'queued'),
        item(2, 'processing'),
        item(3, 'done', { bill_id: 'b3' }),
        item(4, 'failed', { parse_error_message: 'nope' }),
      ])
    );
    useBillBatchStore.getState().setWaiting('r', { set: 1 });
    renderBell();
    await open();
    expect(await screen.findByText('Queued')).toBeInTheDocument();
    expect(screen.getByText('Waiting (AI limit)')).toBeInTheDocument();
    expect(screen.getByText('Reading…')).toBeInTheDocument();
    expect(screen.getByText('Draft ready')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Photo 5')).toBeInTheDocument();
  });

  it('a done row links to the draft; a failed row shows the message and links to the failed group', async () => {
    seed(
      makeBatch(
        'l',
        [
          item(0, 'done', { bill_id: 'bill-9' }),
          item(1, 'failed', { parse_error_message: 'Not a receipt' }),
        ],
        true
      )
    );
    renderBell();
    await open();
    expect(
      await screen.findByRole('menuitem', { name: 'Review' })
    ).toHaveAttribute('href', '/bills/drafts/bill-9');
    expect(screen.getByText('Not a receipt')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveAttribute(
      'href',
      '/bills/drafts#failed'
    );
    expect(
      screen.getByRole('menuitem', { name: 'View drafts' })
    ).toHaveAttribute('href', '/bills/drafts');
  });

  it('the batch summary reads "3 photos · 1 read · 1 failed · 1 in progress"', async () => {
    seed(
      makeBatch('s', [
        item(0, 'done', { bill_id: 'b' }),
        item(1, 'failed'),
        item(2, 'processing'),
      ])
    );
    renderBell();
    await open();
    expect(
      await screen.findByText('3 photos · 1 read · 1 failed · 1 in progress')
    ).toBeInTheDocument();
  });

  it('Dismiss removes a completed batch; Clear finished removes all completed', async () => {
    seed(
      makeBatch(
        'c1',
        [item(0, 'done', { bill_id: 'b' }), item(1, 'done', { bill_id: 'c' })],
        true
      )
    );
    seed(
      makeBatch(
        'c2',
        [item(0, 'done', { bill_id: 'd' }), item(1, 'failed')],
        true
      )
    );
    seed(makeBatch('run', [item(0, 'queued'), item(1, 'queued')]));
    renderBell();
    await open();
    const dismiss = await screen.findAllByRole('button', { name: 'Dismiss' });
    expect(dismiss).toHaveLength(2);
    await userEvent.click(dismiss.at(0) ?? document.body);
    expect(
      useBillBatchStore.getState().batches.map((b) => b.batchId)
    ).toHaveLength(2);
  });

  it('Clear finished removes all completed batches', async () => {
    seed(
      makeBatch(
        'c1',
        [item(0, 'done', { bill_id: 'b' }), item(1, 'done', { bill_id: 'c' })],
        true
      )
    );
    seed(
      makeBatch(
        'c2',
        [item(0, 'done', { bill_id: 'd' }), item(1, 'failed')],
        true
      )
    );
    seed(makeBatch('run', [item(0, 'queued'), item(1, 'queued')]));
    renderBell();
    await open();
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Clear finished' })
    );
    expect(useBillBatchStore.getState().batches.map((b) => b.batchId)).toEqual([
      'run',
    ]);
  });

  it("a batch query error shows Couldn't load with Retry", async () => {
    useBillBatchStore
      .getState()
      .track(
        makeBatch('e', [item(0, 'queued'), item(1, 'queued')]),
        TEST_HID,
        {}
      );
    const { billsApi } = await import('@/pages/bills/api');
    const { vi } = await import('vitest');
    const spy = vi
      .spyOn(billsApi, 'batch')
      .mockRejectedValue(new Error('boom'));
    renderBell();
    await open();
    expect(await screen.findByText("Couldn't load")).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Try again' });
    await userEvent.click(retry);
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
    spy.mockRestore();
  });
});
