import '@/i18n';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { HouseholdTestProvider } from '@/test/household';
import { Toaster } from '@/components/ui/toaster';
import type { DuplicateSuggestionPair, PossibleDuplicate } from '@/types/bills';
import { DuplicateSuggestions } from './DuplicateSuggestions';

const SUGGESTIONS = '/households/hh-1/bills/duplicate-suggestions';

const bill = (id: string, name: string): PossibleDuplicate => ({
  id,
  bill_date: '2026-10-03',
  total_amount: 412.5,
  currency: 'MDL',
  market_name: 'Linella',
  created_by_name: name,
});
const PAIR: DuplicateSuggestionPair = {
  bill: bill('a1', 'Ana'),
  other: bill('b2', 'Ion'),
  match: 'fiscal',
};

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <HouseholdTestProvider>
        <MemoryRouter initialEntries={['/bills/duplicates']}>
          <Routes>
            <Route
              path="/bills/duplicates"
              element={<DuplicateSuggestions />}
            />
          </Routes>
        </MemoryRouter>
        <Toaster />
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
}

describe('DuplicateSuggestions', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet('/households/hh-1/bills/drafts').reply(200, {
      data: [],
      meta: { total: 0, page: 1, limit: 20, total_pages: 0 },
    });
  });
  afterEach(() => {
    mock.restore();
  });

  it('lists pairs with both bills and the match label', async () => {
    mock.onGet(SUGGESTIONS).reply(200, { pairs: [PAIR] });
    renderPage();
    const card = await screen.findByRole('article');
    expect(within(card).getByText('Same receipt')).toBeInTheDocument();
    expect(within(card).getByText('Added by Ana')).toBeInTheDocument();
    expect(within(card).getByText('Added by Ion')).toBeInTheDocument();
    expect(
      within(card)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href'))
    ).toEqual(['/bills/confirmed/a1', '/bills/confirmed/b2']);
  });

  it('This one is the copy under the right bill marks it against the left', async () => {
    mock
      .onGet(SUGGESTIONS)
      .replyOnce(200, { pairs: [PAIR] })
      .onGet(SUGGESTIONS)
      .reply(() => new Promise(() => undefined));
    let body: unknown;
    mock.onPost('/households/hh-1/bills/b2/mark-duplicate').reply((config) => {
      body = JSON.parse(config.data as string);
      return [200, { id: 'b2', status: 'duplicate' }];
    });
    renderPage();
    const buttons = await screen.findAllByRole('button', {
      name: 'This one is the copy',
    });
    await userEvent.click(buttons[1]!);
    await waitFor(() => expect(screen.queryByRole('article')).toBeNull());
    expect(body).toEqual({ duplicate_of_id: 'a1' });
  });

  it('Keep both dismisses the pair', async () => {
    mock
      .onGet(SUGGESTIONS)
      .replyOnce(200, { pairs: [PAIR] })
      .onGet(SUGGESTIONS)
      .reply(200, { pairs: [] });
    let body: unknown;
    mock
      .onPost('/households/hh-1/bills/a1/dismiss-duplicate')
      .reply((config) => {
        body = JSON.parse(config.data as string);
        return [204];
      });
    renderPage();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Keep both' })
    );
    await waitFor(() => expect(screen.queryByRole('article')).toBeNull());
    expect(body).toEqual({ other_bill_id: 'b2' });
  });

  it('double click sends one request', async () => {
    mock.onGet(SUGGESTIONS).reply(200, { pairs: [PAIR] });
    mock
      .onPost('/households/hh-1/bills/a1/dismiss-duplicate')
      .reply(() => new Promise(() => undefined));
    renderPage();
    const keep = await screen.findByRole('button', { name: 'Keep both' });
    fireEvent.click(keep);
    fireEvent.click(keep);
    await waitFor(() => expect(keep).toBeDisabled());
    expect(mock.history.post).toHaveLength(1);
  });

  it('empty state', async () => {
    mock.onGet(SUGGESTIONS).reply(200, { pairs: [] });
    renderPage();
    expect(
      await screen.findByText('No possible duplicates')
    ).toBeInTheDocument();
  });

  it('error state with Retry', async () => {
    mock
      .onGet(SUGGESTIONS)
      .replyOnce(500, {})
      .onGet(SUGGESTIONS)
      .reply(200, { pairs: [] });
    renderPage();
    await userEvent.click(
      await screen.findByRole('button', { name: /retry/i })
    );
    expect(
      await screen.findByText('No possible duplicates')
    ).toBeInTheDocument();
  });

  it('date range is sent', async () => {
    const seen: unknown[] = [];
    mock.onGet(SUGGESTIONS).reply((config) => {
      seen.push(config.params);
      return [200, { pairs: [] }];
    });
    renderPage();
    await screen.findByText('No possible duplicates');
    fireEvent.change(screen.getByLabelText(/from/i), {
      target: { value: '2026-10-01' },
    });
    await waitFor(() =>
      expect(seen).toContainEqual({ date_from: '2026-10-01' })
    );
  });
});
