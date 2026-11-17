import { describe, it, expect } from 'vitest';
import { ApiError } from '@/auth/apiError';
import { readMissingIds, readMoveConflicts } from './moveErrors';

describe('readMoveConflicts', () => {
  it('reads every known reason', () => {
    const conflicts = [
      { id: 'a', reason: 'status_not_movable' },
      { id: 'b', reason: 'has_duplicates' },
      { id: 'c', reason: 'draft_image_conflict' },
      { id: 'd', reason: 'client_batch_conflict' },
    ];
    expect(readMoveConflicts(new ApiError(409, { conflicts }))).toEqual(
      conflicts
    );
  });

  it('maps an unknown reason', () => {
    expect(
      readMoveConflicts(
        new ApiError(409, { conflicts: [{ id: 'a', reason: 'weird' }] })
      )
    ).toEqual([{ id: 'a', reason: 'unknown' }]);
  });

  it('drops malformed entries', () => {
    expect(
      readMoveConflicts(
        new ApiError(409, {
          conflicts: [{ reason: 'has_duplicates' }, 'x', { id: 'b' }],
        })
      )
    ).toEqual([{ id: 'b', reason: 'unknown' }]);
  });

  it('is null for a 409 without conflicts', () => {
    expect(readMoveConflicts(new ApiError(409, { message: 'x' }))).toBeNull();
  });

  it('is null for other statuses', () => {
    expect(readMoveConflicts(new ApiError(400, { conflicts: [] }))).toBeNull();
  });

  it('is null for a non-ApiError', () => {
    expect(readMoveConflicts(new Error('x'))).toBeNull();
  });
});

describe('readMissingIds', () => {
  it('reads missing ids', () => {
    expect(readMissingIds(new ApiError(404, { bill_ids: ['a'] }))).toEqual([
      'a',
    ]);
  });

  it('is null for a 404 without bill_ids', () => {
    expect(readMissingIds(new ApiError(404, { message: 'x' }))).toBeNull();
  });

  it('is null for a non-ApiError', () => {
    expect(readMissingIds(new Error('x'))).toBeNull();
  });
});
