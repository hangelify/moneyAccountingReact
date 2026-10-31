import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import type { ReactElement } from 'react';
import { apiClient } from '@/auth/apiClient';
import {
  HouseholdTestProvider,
  TEST_HOUSEHOLDS,
  makeHouseholdValue,
} from '@/test/household';
import { EUR, MDL, breakdown } from '@/test/spending';
import { SpendingBreakdownCard } from './SpendingBreakdownCard';

const URL = '/households/hh-1/bills/dashboard/spending-breakdown';

function LocationProbe(): ReactElement {
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
}

function renderCard(search = ''): { switchHousehold: (i: number) => void } {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (household = TEST_HOUSEHOLDS[0]!): ReactElement => (
    <QueryClientProvider client={qc}>
      <HouseholdTestProvider
        value={makeHouseholdValue({ activeHousehold: household })}
      >
        <MemoryRouter initialEntries={[`/dashboard${search}`]}>
          <SpendingBreakdownCard />
          <LocationProbe />
        </MemoryRouter>
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
  const { rerender } = render(tree());
  return {
    switchHousehold: (i) => rerender(tree(TEST_HOUSEHOLDS[i])),
  };
}

const search = (): string => screen.getByTestId('search').textContent ?? '';

describe('SpendingBreakdownCard', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(2026, 9, 31, 12), toFake: ['Date'] });
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
    vi.useRealTimers();
  });

  it('requests month/today by default', async () => {
    mock.onGet(URL).reply(200, breakdown([MDL]));
    renderCard();
    await screen.findByRole('button', { name: /^Food,/ });
    expect(mock.history.get[0]!.params).toEqual({
      period: 'month',
      anchor: '2026-10-31',
    });
    expect(screen.getAllByText('October 2026').length).toBeGreaterThan(0);
  });

  it('shows the empty state for no currencies', async () => {
    mock.onGet(URL).reply(200, breakdown([]));
    renderCard();
    expect(
      await screen.findByText('No spending in this period')
    ).toBeInTheDocument();
  });

  it('hides tabs for a single currency', async () => {
    mock.onGet(URL).reply(200, breakdown([MDL]));
    renderCard();
    await screen.findByRole('button', { name: /^Food,/ });
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('shows tabs for two currencies and selects the largest', async () => {
    mock.onGet(URL).reply(200, breakdown([EUR, MDL]));
    renderCard();
    expect(await screen.findByRole('tab', { name: 'EUR' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    fireEvent.click(screen.getByRole('tab', { name: 'MDL' }));
    expect(
      await screen.findByRole('button', { name: /^Food, MDL/ })
    ).toBeInTheDocument();
  });

  it('previous updates the URL', async () => {
    mock.onGet(URL).reply(200, breakdown([MDL]));
    renderCard();
    await screen.findByRole('button', { name: /^Food,/ });
    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));
    await waitFor(() => expect(search()).toContain('anchor=2026-09-30'));
  });

  it('two quick previous clicks move back two months', async () => {
    mock.onGet(URL).reply(200, breakdown([MDL]));
    renderCard();
    await screen.findByRole('button', { name: /^Food,/ });
    mock.reset();
    mock
      .onGet(URL)
      .reply(
        () =>
          new Promise((r) => setTimeout(() => r([200, breakdown([MDL])]), 50))
      );
    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));
    await waitFor(() => expect(search()).toContain('anchor=2026-08-31'));
  });

  it('rewrites an invalid URL', async () => {
    mock.onGet(URL).reply(200, breakdown([MDL]));
    renderCard('?period=decade');
    await waitFor(() => expect(search()).toContain('period=month'));
    expect(search()).toContain('anchor=2026-10-31');
  });

  it('keeps the chart and shows Retry on 500', async () => {
    mock.onGet(URL).replyOnce(200, breakdown([MDL]));
    renderCard();
    await screen.findByRole('button', { name: /^Food,/ });
    mock.onGet(URL).reply(500, { message: 'Internal server error' });
    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));
    expect(
      await screen.findByRole('button', { name: 'Retry' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Food,/ })).toBeInTheDocument();
  });

  it('shows an error panel with Retry when the first load fails', async () => {
    mock
      .onGet(URL)
      .replyOnce(500, {})
      .onGet(URL)
      .reply(200, breakdown([MDL]));
    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('button', { name: /^Food,/ })
    ).toBeInTheDocument();
  });

  it('zooming into a category switches the legend to its sub-categories', async () => {
    mock.onGet(URL).reply(200, breakdown([MDL]));
    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: /^Food,/ }));
    const rows = await screen.findAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Bread'),
      expect.stringContaining('Dairy'),
    ]);
  });

  it("never shows another household's spending after a switch", async () => {
    mock.onGet(URL).reply(200, breakdown([MDL]));
    const { switchHousehold } = renderCard();
    await screen.findByRole('button', { name: /^Food,/ });
    mock
      .onGet('/households/hh-2/bills/dashboard/spending-breakdown')
      .reply(500, {});
    switchHousehold(1);
    expect(screen.queryByRole('button', { name: /^Food,/ })).toBeNull();
    expect(
      await screen.findByRole('button', { name: 'Retry' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Food,/ })).toBeNull();
  });
});
