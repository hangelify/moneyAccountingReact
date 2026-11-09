import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { useBillBatchStore, __resetBillBatchStore } from './billBatchStore';
import type { BillBatch } from '@/types/bills';

function makeBatch(id: string): BillBatch {
  return {
    batch_id: id,
    created_at: `2026-11-03T10:00:0${id.length}Z`,
    total: 0,
    items: [],
    completed: false,
  };
}

const store = (): ReturnType<typeof useBillBatchStore.getState> =>
  useBillBatchStore.getState();
const stored = (): unknown =>
  JSON.parse(sessionStorage.getItem('billBatches') ?? 'null');

describe('billBatchStore', () => {
  let revoke: MockInstance<(url: string) => void>;
  beforeEach(() => {
    sessionStorage.clear();
    __resetBillBatchStore();
    revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('track puts the newest batch first and is idempotent for the same batchId', () => {
    store().track(makeBatch('a'), 'h1', { 0: 'blob:a0' });
    store().track(makeBatch('bb'), 'h1', { 0: 'blob:b0' });
    expect(store().batches.map((b) => b.batchId)).toEqual(['bb', 'a']);
    store().track(makeBatch('a'), 'h1', { 0: 'blob:other' });
    expect(store().batches.map((b) => b.batchId)).toEqual(['bb', 'a']);
    expect(store().batches[1]?.thumbnails).toEqual({ 0: 'blob:a0' });
    expect(store().batches[1]).toMatchObject({
      hid: 'h1',
      waiting: [],
      unseen: false,
      createdAt: makeBatch('a').created_at,
    });
  });

  it('setWaiting adds and removes positions', () => {
    store().track(makeBatch('a'), 'h1', {});
    store().setWaiting('a', { set: 2 });
    store().setWaiting('a', { set: 2 });
    store().setWaiting('a', { set: 3 });
    expect(store().batches[0]?.waiting).toEqual([2, 3]);
    store().setWaiting('a', { clear: 2 });
    expect(store().batches[0]?.waiting).toEqual([3]);
  });

  it('markUnseen then markAllSeen(hid) clears unseen only for that hid', () => {
    store().track(makeBatch('a'), 'h1', {});
    store().track(makeBatch('bb'), 'h2', {});
    store().markUnseen('a');
    store().markUnseen('bb');
    expect(store().batches.every((b) => b.unseen)).toBe(true);
    store().markAllSeen('h1');
    const byId = Object.fromEntries(
      store().batches.map((b) => [b.batchId, b.unseen])
    );
    expect(byId).toEqual({ a: false, bb: true });
  });

  it("dismiss revokes that batch's thumbnail URLs", () => {
    store().track(makeBatch('a'), 'h1', { 0: 'blob:0', 1: 'blob:1' });
    store().dismiss('a');
    expect(revoke).toHaveBeenCalledWith('blob:0');
    expect(revoke).toHaveBeenCalledWith('blob:1');
    expect(store().batches).toEqual([]);
  });

  it('dismissCompleted removes only the listed ids of that hid', () => {
    store().track(makeBatch('a'), 'h1', { 0: 'blob:a' });
    store().track(makeBatch('bb'), 'h1', {});
    store().track(makeBatch('ccc'), 'h2', {});
    store().dismissCompleted('h1', ['a', 'ccc']);
    expect(store().batches.map((b) => b.batchId)).toEqual(['ccc', 'bb']);
    expect(revoke).toHaveBeenCalledWith('blob:a');
  });

  it('persists to sessionStorage without thumbnails and restore() reads it back', () => {
    store().track(makeBatch('a'), 'h1', { 0: 'blob:a' });
    store().markUnseen('a');
    expect(stored()).toEqual([
      expect.objectContaining({ batchId: 'a', thumbnails: {}, unseen: true }),
    ]);
    useBillBatchStore.setState({ batches: [] });
    store().restore();
    expect(store().batches).toHaveLength(1);
    expect(store().batches[0]).toMatchObject({
      batchId: 'a',
      thumbnails: {},
      unseen: true,
    });
  });

  it('restore() survives a throwing sessionStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error();
    });
    store().restore();
    expect(store().batches).toEqual([]);
  });

  it('restore() gives [] for invalid JSON or a non-array', () => {
    sessionStorage.setItem('billBatches', '{nope');
    store().restore();
    expect(store().batches).toEqual([]);
    sessionStorage.setItem('billBatches', '{"a":1}');
    store().restore();
    expect(store().batches).toEqual([]);
  });

  it('restore() drops elements without the required string fields', () => {
    sessionStorage.setItem(
      'billBatches',
      JSON.stringify([null, 1, { batchId: 'x' }])
    );
    store().restore();
    expect(store().batches).toEqual([]);
  });

  it('restore() forces thumbnails to {} and defaults waiting and unseen', () => {
    sessionStorage.setItem(
      'billBatches',
      JSON.stringify([
        {
          batchId: 'a',
          hid: 'h1',
          createdAt: 't',
          thumbnails: { 0: 'blob:stale' },
          waiting: [1, 'x', 2],
          unseen: 'yes',
        },
        { batchId: 'b', hid: 'h1', createdAt: 't', waiting: 'nope' },
        { batchId: 'c', hid: 'h1', createdAt: 't', waiting: [3], unseen: true },
      ])
    );
    store().restore();
    expect(store().batches).toEqual([
      {
        batchId: 'a',
        hid: 'h1',
        createdAt: 't',
        thumbnails: {},
        waiting: [1, 2],
        unseen: false,
      },
      {
        batchId: 'b',
        hid: 'h1',
        createdAt: 't',
        thumbnails: {},
        waiting: [],
        unseen: false,
      },
      {
        batchId: 'c',
        hid: 'h1',
        createdAt: 't',
        thumbnails: {},
        waiting: [3],
        unseen: true,
      },
    ]);
  });

  it('clear revokes all URLs and removes the storage key', () => {
    store().track(makeBatch('a'), 'h1', { 0: 'blob:a' });
    store().track(makeBatch('bb'), 'h2', { 0: 'blob:b' });
    store().clear();
    expect(revoke).toHaveBeenCalledWith('blob:a');
    expect(revoke).toHaveBeenCalledWith('blob:b');
    expect(store().batches).toEqual([]);
    expect(sessionStorage.getItem('billBatches')).toBeNull();
  });
});
