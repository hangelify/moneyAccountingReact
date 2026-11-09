import { describe, expect, it } from 'vitest';
import type {
  BatchCompletedData,
  BatchItemStatus,
  BillBatch,
  ItemEventData,
} from '../../types/bills';
import { applyBatchEvent } from './applyBatchEvent';

const makeBatch = (): BillBatch => ({
  batch_id: 'b1',
  created_at: '2026-11-03T10:00:00Z',
  total: 3,
  completed: false,
  items: [0, 1, 2].map((position) => ({
    id: `i${position}`,
    position,
    status: 'queued' as const,
    bill_id: null,
    parse_error_code: null,
    parse_error_message: null,
  })),
});

const itemEvent = (
  position: number,
  status: BatchItemStatus,
  extra: Partial<ItemEventData> = {}
): ItemEventData => ({
  batch_id: 'b1',
  item_id: `i${position}`,
  position,
  status,
  created_by_user_id: 'u1',
  ...extra,
});

describe('applyBatchEvent', () => {
  it('item.processing sets status of the matching position only', () => {
    const { batch } = applyBatchEvent(
      makeBatch(),
      'item.processing',
      itemEvent(1, 'processing')
    );
    expect(batch.items.map((i) => i.status)).toEqual([
      'queued',
      'processing',
      'queued',
    ]);
  });

  it('item.done sets bill_id and clears errors', () => {
    const failed = applyBatchEvent(
      makeBatch(),
      'item.failed',
      itemEvent(0, 'failed', {
        parse_error_code: 'ai_failed',
        parse_error_message: 'x',
      })
    ).batch;
    const { batch } = applyBatchEvent(
      failed,
      'item.done',
      itemEvent(0, 'done', { bill_id: 'bill-1' })
    );
    expect(batch.items[0]).toMatchObject({
      status: 'done',
      bill_id: 'bill-1',
      parse_error_code: null,
      parse_error_message: null,
    });
  });

  it('item.failed sets bill_id, parse_error_code and parse_error_message', () => {
    const { batch } = applyBatchEvent(
      makeBatch(),
      'item.failed',
      itemEvent(2, 'failed', {
        bill_id: 'bill-9',
        parse_error_code: 'not_a_receipt',
        parse_error_message: 'Not a receipt',
      })
    );
    expect(batch.items[2]).toMatchObject({
      status: 'failed',
      bill_id: 'bill-9',
      parse_error_code: 'not_a_receipt',
      parse_error_message: 'Not a receipt',
    });
  });

  it('processing then queued reports waiting.set = position', () => {
    const first = applyBatchEvent(
      makeBatch(),
      'item.processing',
      itemEvent(1, 'processing')
    );
    const second = applyBatchEvent(
      first.batch,
      'item.processing',
      itemEvent(1, 'queued')
    );
    expect(second.waiting).toEqual({ set: 1 });
    expect(second.batch.items[1]?.status).toBe('queued');
  });

  it('any non-queued status reports waiting.clear = position', () => {
    const { waiting } = applyBatchEvent(
      makeBatch(),
      'item.processing',
      itemEvent(2, 'processing')
    );
    expect(waiting).toEqual({ clear: 2 });
    const done = applyBatchEvent(
      makeBatch(),
      'item.done',
      itemEvent(0, 'done', { bill_id: 'b' })
    );
    expect(done.waiting).toEqual({ clear: 0 });
  });

  it('batch.completed sets completed true and leaves items unchanged', () => {
    const start = makeBatch();
    const data: BatchCompletedData = {
      batch_id: 'b1',
      total: 3,
      done: 2,
      failed: 1,
      created_by_user_id: 'u1',
    };
    const { batch, waiting } = applyBatchEvent(start, 'batch.completed', data);
    expect(batch.completed).toBe(true);
    expect(batch.items).toEqual(start.items);
    expect(waiting).toEqual({});
  });

  it('event with another batch_id returns the same batch object', () => {
    const start = makeBatch();
    const { batch, waiting } = applyBatchEvent(
      start,
      'item.done',
      itemEvent(0, 'done', { batch_id: 'other' })
    );
    expect(batch).toBe(start);
    expect(waiting).toEqual({});
  });

  it('two positions done with the same bill_id both end done', () => {
    let b = makeBatch();
    b = applyBatchEvent(
      b,
      'item.done',
      itemEvent(0, 'done', { bill_id: 'same' })
    ).batch;
    b = applyBatchEvent(
      b,
      'item.done',
      itemEvent(1, 'done', { bill_id: 'same' })
    ).batch;
    expect(b.items.map((i) => i.status)).toEqual(['done', 'done', 'queued']);
    expect(b.items[0]?.bill_id).toBe('same');
    expect(b.items[1]?.bill_id).toBe('same');
  });

  it('does not mutate the input batch', () => {
    const start = makeBatch();
    const snapshot = structuredClone(start);
    applyBatchEvent(start, 'item.done', itemEvent(0, 'done', { bill_id: 'x' }));
    expect(start).toEqual(snapshot);
  });
});
