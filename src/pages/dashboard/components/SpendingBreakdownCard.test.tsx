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

// Legend rows only; the breadcrumb is a list too.
const legendItems = (): HTMLElement[] =>
  screen.getAllByRole('listitem').filter((li) => !li.closest('nav'));

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
    await screen.findByRole('button', { name: 'All categories' });
    const rows = legendItems();
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

  describe('zoom', () => {
    const MONTH = '?period=month&anchor=2026-10-31';
    const legendRows = (): string[] =>
      legendItems().map((r) => r.textContent ?? '');

    const crumbs = (): HTMLElement =>
      screen.getByRole('navigation', { name: 'Breadcrumb' });
    const currentCrumb = (): string | null =>
      crumbs().querySelector('[aria-current="page"]')?.textContent ?? null;
    const backLink = (): HTMLElement | null =>
      screen.queryByRole('button', { name: 'All categories' });

    it('shows All categories as the current crumb with the total', async () => {
      mock.onGet(URL).reply(200, breakdown([MDL]));
      renderCard(MONTH);
      await screen.findByRole('button', { name: /^Food,/ });
      expect(currentCrumb()).toBe('All categories');
      expect(backLink()).toBeNull();
      expect(crumbs()).toHaveTextContent(/MDL\s?1,250\.40/);
    });

    it('zooming makes All categories a link back', async () => {
      mock.onGet(URL).reply(200, breakdown([MDL]));
      renderCard(MONTH);
      fireEvent.click(await screen.findByRole('button', { name: /^Food,/ }));
      await waitFor(() => expect(search()).toContain('category=food'));
      expect(currentCrumb()).toBe('Food');
      expect(crumbs()).toHaveTextContent(/MDL\s?910\.40/);
      expect(crumbs()).toHaveTextContent('72.81%');

      fireEvent.click(backLink()!);
      await waitFor(() => expect(search()).not.toContain('category'));
      expect(currentCrumb()).toBe('All categories');
      expect(legendRows()[0]).toContain('Food');
    });

    it('opens zoomed from the URL', async () => {
      mock.onGet(URL).reply(200, breakdown([MDL]));
      renderCard(`${MONTH}&category=food`);
      await screen.findByRole('button', { name: 'All categories' });
      expect(legendRows()).toEqual([
        expect.stringContaining('Bread'),
        expect.stringContaining('Dairy'),
      ]);
      expect(mock.history.get[0]!.params).not.toHaveProperty('category');
    });

    it('drops the zoom when the period changes', async () => {
      mock.onGet(URL).reply(200, breakdown([MDL]));
      renderCard(`${MONTH}&category=food`);
      await screen.findByRole('button', { name: 'All categories' });
      fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));
      await waitFor(() => expect(search()).toContain('anchor=2026-09-30'));
      expect(search()).not.toContain('category');
    });

    it('drops a category that is not in the data', async () => {
      mock.onGet(URL).reply(200, breakdown([MDL]));
      renderCard(`${MONTH}&category=gone`);
      await screen.findByRole('button', { name: /^Food,/ });
      await waitFor(() => expect(search()).not.toContain('category'));
      expect(currentCrumb()).toBe('All categories');
    });
  });
});
