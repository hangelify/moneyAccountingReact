import '@/i18n';
import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { toast } from '@/hooks/use-toast';
import type * as UseToastModule from '@/hooks/use-toast';
import { useDuplicateMutations } from './useDuplicateMutations';

vi.mock('@/hooks/use-toast', async (importOriginal) => {
  const actual = await importOriginal<typeof UseToastModule>();
  return { ...actual, toast: vi.fn() };
});

const toastTitles = (): unknown[] =>
  vi.mocked(toast).mock.calls.map((c) => c[0].title);

const BASE = '/households/hh-1/bills';

describe('useDuplicateMutations', () => {
  let mock: MockAdapter;
  let qc: QueryClient;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    vi.mocked(toast).mockClear();
  });

  afterEach(() => {
    mock.restore();
  });

  const setup = () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return renderHook(() => useDuplicateMutations('hh-1'), { wrapper }).result;
  };

  it('mark writes the returned bill into the detail cache', async () => {
    const reply = { id: 'b1', status: 'duplicate' };
    mock.onPost(`${BASE}/b1/mark-duplicate`).reply(200, reply);
    const result = setup();
    await act(() =>
      result.current.mark.mutateAsync({ id: 'b1', duplicateOfId: 'b0' })
    );
    expect(qc.getQueryData(['households', 'hh-1', 'bill', 'b1'])).toEqual(
      reply
    );
  });

  it('mark invalidates lists, bills and dashboard', async () => {
    mock.onPost(`${BASE}/b1/mark-duplicate`).reply(200, { id: 'b1' });
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const result = setup();
    await act(() =>
      result.current.mark.mutateAsync({ id: 'b1', duplicateOfId: 'b0' })
    );
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ['households', 'hh-1', 'bills'],
        ['households', 'hh-1', 'bill'],
        ['households', 'hh-1', 'dashboard'],
      ])
    );
  });

  it('409 on mark toasts conflict and refetches the bill', async () => {
    mock.onPost(`${BASE}/b1/mark-duplicate`).reply(409, {
      message: 'Bill is already a duplicate',
    });
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const result = setup();
    await act(async () => {
      await result.current.mark
        .mutateAsync({ id: 'b1', duplicateOfId: 'b0' })
        .catch(() => undefined);
    });
    expect(toastTitles()).toEqual([
      'This bill changed. Showing the latest version.',
    ]);
    expect(spy.mock.calls.map((c) => c[0]?.queryKey)).toContainEqual([
      'households',
      'hh-1',
      'bill',
      'b1',
    ]);
  });

  it('404 toasts notFound', async () => {
    mock.onPost(`${BASE}/b1/unmark-duplicate`).reply(404, {});
    const result = setup();
    await act(async () => {
      await result.current.unmark
        .mutateAsync({ id: 'b1' })
        .catch(() => undefined);
    });
    expect(toastTitles()).toEqual(['That bill no longer exists.']);
  });

  it('400 toasts invalid with the server message', async () => {
    mock.onPost(`${BASE}/b1/mark-duplicate`).reply(400, {
      message: ['duplicate_of_id would create a cycle'],
    });
    const result = setup();
    await act(async () => {
      await result.current.mark
        .mutateAsync({ id: 'b1', duplicateOfId: 'b0' })
        .catch(() => undefined);
    });
    expect(vi.mocked(toast)).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't mark this bill",
        description: 'duplicate_of_id would create a cycle',
      })
    );
  });

  it('dismiss with silent: true shows no toast on error', async () => {
    mock.onPost(`${BASE}/d1/dismiss-duplicate`).reply(500, {});
    const result = setup();
    await act(async () => {
      await result.current.dismiss
        .mutateAsync({ id: 'd1', otherBillId: 'b0', silent: true })
        .catch(() => undefined);
    });
    expect(toast).not.toHaveBeenCalled();
  });

  it('403 shows no toast', async () => {
    mock.onPost(`${BASE}/b1/mark-duplicate`).reply(403, {});
    const result = setup();
    await act(async () => {
      await result.current.mark
        .mutateAsync({ id: 'b1', duplicateOfId: 'b0' })
        .catch(() => undefined);
    });
    expect(toast).not.toHaveBeenCalled();
  });
});
