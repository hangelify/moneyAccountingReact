import { useEffect, type ReactElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { TEST_HOUSEHOLDS } from '@/test/household';
import type { Household } from '@/types/households';
import {
  MoveResultProvider,
  useMoveResult,
  type MoveResultApi,
} from './MoveResultProvider';
import type {
  MoveBillRef,
  MovedBillInfo,
  MoveFailure,
  MoveOutcome,
} from './types';

vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));

const [, family] = TEST_HOUSEHOLDS as [Household, Household];

const info = (id: string, lostCategory = 0): MovedBillInfo => ({
  id,
  status: 'confirmed',
  marketName: 'Shop',
  billDate: '2026-11-01',
  total: 1,
  currency: 'EUR',
  lostCategory,
  lostSubCategory: 0,
  alreadyMoved: false,
});

const outcome = (moved: MovedBillInfo[]): MoveOutcome => ({
  target: family,
  moved,
  lostLines: moved.reduce((n, b) => n + b.lostCategory, 0),
  lostSubLines: 0,
  withLosses: moved.filter((b) => b.lostCategory > 0),
});

const holder: { api: MoveResultApi | null } = { api: null };

function Probe(): ReactElement {
  const api = useMoveResult();
  useEffect(() => {
    holder.api = api;
  }, [api]);
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderProvider(): void {
  render(
    <MemoryRouter initialEntries={['/bills']}>
      <MoveResultProvider showDuplicatesHref="/bills?include_duplicates=true">
        <Routes>
          <Route path="*" element={<Probe />} />
        </Routes>
      </MoveResultProvider>
    </MemoryRouter>
  );
}

type ToastArg = Parameters<typeof toast>[0];
const lastToast = (): ToastArg => {
  const arg = vi.mocked(toast).mock.calls.at(-1)?.[0];
  if (!arg) throw new Error('no toast');
  return arg;
};

function run(fn: (api: MoveResultApi) => void): void {
  act(() => {
    if (holder.api) fn(holder.api);
  });
}

function fail(failure: MoveFailure, bills: MoveBillRef[] = []): void {
  run((api) => api.reportFailure(failure, { bills }));
}

describe('MoveResultProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('success without losses toasts and opens no dialog', () => {
    renderProvider();
    run((api) => api.reportSuccess(outcome([info('a'), info('b')])));
    expect(lastToast().title).toMatch(/moved 2 bills to “family budget”/i);
    expect(lastToast().action).toBeUndefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('success of one bill has an Open action to the target', async () => {
    renderProvider();
    run((api) => api.reportSuccess(outcome([info('a')])));
    expect(lastToast().title).toMatch(/moved 1 bill/i);
    render(<>{lastToast().action}</>);
    await userEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(screen.getByTestId('where')).toHaveTextContent('/bills/a?hid=hh-2');
  });

  it('success with losses opens the dialog and mentions lost items', () => {
    renderProvider();
    run((api) => api.reportSuccess(outcome([info('a', 2), info('b')])));
    expect(lastToast().description).toBe('2 items left without a category');
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('missing and other toast', () => {
    renderProvider();
    fail({ kind: 'missing', ids: ['a'] });
    expect(lastToast().title).toMatch(/some bills were not found/i);
    fail({ kind: 'other' });
    expect(lastToast()).toMatchObject({ variant: 'destructive' });
    expect(lastToast().title).toMatch(/couldn't move the bills/i);
  });

  it('forbidden reports nothing more', () => {
    renderProvider();
    fail({ kind: 'forbidden' });
    expect(toast).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Show duplicates runs beforeShowDuplicates then navigates', async () => {
    renderProvider();
    const before = vi.fn();
    run((api) =>
      api.reportFailure(
        {
          kind: 'conflicts',
          conflicts: [{ id: 'a', reason: 'has_duplicates' }],
        },
        { bills: [], beforeShowDuplicates: before }
      )
    );
    await userEvent.click(
      screen.getByRole('button', { name: /show duplicates/i })
    );
    expect(before).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('where')).toHaveTextContent(
      '/bills?include_duplicates=true'
    );
  });
});
