import { useEffect } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { HouseholdProvider, useHouseholds } from './HouseholdContext';
import { householdsApi } from '@/pages/households/api';
import { ApiError } from '@/auth/apiError';
import { Toaster } from '@/components/ui/toaster';
import { TEST_HOUSEHOLDS } from '@/test/household';
import '@/i18n';

const auth = { isAuthenticated: true };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: auth.isAuthenticated }),
}));

vi.mock('@/pages/households/api', () => ({
  householdsApi: { list: vi.fn() },
}));

const list = vi.mocked(householdsApi.list);

const ctx: { current: ReturnType<typeof useHouseholds> | null } = {
  current: null,
};

function Probe(): React.JSX.Element {
  const value = useHouseholds();
  useEffect(() => {
    ctx.current = value;
  });
  return (
    <div>
      <span data-testid="status">{value.status}</span>
      <span data-testid="active">{value.activeHousehold?.id ?? ''}</span>
    </div>
  );
}

function Forbidden({ name }: { name: string }): null {
  useQuery({
    queryKey: ['households', 'hh-1', name],
    queryFn: () =>
      Promise.reject(
        new ApiError(403, null, {}, 'Forbidden', { url: '/households/hh-1/x' })
      ),
    retry: false,
  });
  return null;
}

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

const tree = (client: QueryClient, extra?: React.ReactNode) => (
  <QueryClientProvider client={client}>
    <HouseholdProvider>
      <Probe />
      {extra}
      <Toaster />
    </HouseholdProvider>
  </QueryClientProvider>
);

const status = () => screen.getByTestId('status').textContent;
const active = () => screen.getByTestId('active').textContent;

describe('HouseholdProvider', () => {
  beforeEach(() => {
    auth.isAuthenticated = true;
    localStorage.clear();
    list.mockReset();
    list.mockResolvedValue(TEST_HOUSEHOLDS);
  });

  it('does not fetch while signed out', () => {
    auth.isAuthenticated = false;
    render(tree(makeClient()));
    expect(list).not.toHaveBeenCalled();
    expect(status()).toBe('idle');
  });

  it('picks the remembered household when present', async () => {
    localStorage.setItem('activeHouseholdId', 'hh-2');
    render(tree(makeClient()));
    await waitFor(() => expect(active()).toBe('hh-2'));
    expect(status()).toBe('ready');
  });

  it('re-validates a stale remembered id', async () => {
    localStorage.setItem('activeHouseholdId', 'gone');
    render(tree(makeClient()));
    await waitFor(() => expect(active()).toBe('hh-1'));
    await waitFor(() =>
      expect(localStorage.getItem('activeHouseholdId')).toBe('hh-1')
    );
  });

  it('setActiveHouseholdId ignores unknown ids', async () => {
    render(tree(makeClient()));
    await waitFor(() => expect(active()).toBe('hh-1'));
    act(() => ctx.current?.setActiveHouseholdId('nope'));
    expect(active()).toBe('hh-1');
    act(() => ctx.current?.setActiveHouseholdId('hh-2'));
    expect(active()).toBe('hh-2');
    expect(localStorage.getItem('activeHouseholdId')).toBe('hh-2');
  });

  it('clears the remembered id on sign-out', async () => {
    const client = makeClient();
    const { rerender } = render(tree(client));
    await waitFor(() => expect(active()).toBe('hh-1'));
    act(() => ctx.current?.setActiveHouseholdId('hh-2'));
    expect(localStorage.getItem('activeHouseholdId')).toBe('hh-2');

    auth.isAuthenticated = false;
    rerender(tree(client));
    await waitFor(() => expect(status()).toBe('idle'));
    expect(localStorage.getItem('activeHouseholdId')).toBeNull();
    expect(client.getQueryData(['households'])).toBeUndefined();
  });

  it('reports empty and error statuses', async () => {
    list.mockResolvedValue([]);
    const first = render(tree(makeClient()));
    await waitFor(() => expect(status()).toBe('empty'));
    first.unmount();

    list.mockRejectedValue(new ApiError(500, null, {}, 'boom'));
    render(tree(makeClient()));
    await waitFor(() => expect(status()).toBe('error'));
  });

  it('handleForbidden refetches once for parallel 403s', async () => {
    render(
      tree(
        makeClient(),
        <>
          <Forbidden name="x" />
          <Forbidden name="y" />
        </>
      )
    );
    await screen.findByText('You no longer have access to this household.');
    expect(list).toHaveBeenCalledTimes(2);
    expect(
      screen.getAllByText('You no longer have access to this household.')
    ).toHaveLength(1);
  });
});
