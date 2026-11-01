import '@/i18n';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { HouseholdTestProvider } from '@/test/household';
import { BillsTabs } from './BillsTabs';

const pair = (i: number) => ({
  bill: { id: `a${i}` },
  other: { id: `b${i}` },
  match: 'weak',
});

function renderTabs(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <HouseholdTestProvider>
        <MemoryRouter initialEntries={['/bills']}>
          <BillsTabs />
        </MemoryRouter>
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
}

describe('BillsTabs', () => {
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

  it('shows the duplicates count', async () => {
    mock
      .onGet('/households/hh-1/bills/duplicate-suggestions')
      .reply(200, { pairs: [pair(1), pair(2)] });
    renderTabs();
    const link = await screen.findByRole('link', {
      name: 'Possible duplicates (2)',
    });
    expect(link).toHaveAttribute('href', '/bills/duplicates');
  });

  it('shows 100+ at 100 pairs', async () => {
    mock.onGet('/households/hh-1/bills/duplicate-suggestions').reply(200, {
      pairs: Array.from({ length: 100 }, (_, i) => pair(i)),
    });
    renderTabs();
    expect(
      await screen.findByRole('link', { name: 'Possible duplicates (100+)' })
    ).toBeInTheDocument();
  });
});
