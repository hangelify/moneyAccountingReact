import '@/i18n';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { apiClient } from '@/auth/apiClient';
import { NewBillReview } from './NewBillReview';
import { useBillDraftStore } from '@/stores/billDraftStore';

function LocationProbe(): null {
  const loc = useLocation();
  useEffect(() => {
    document.body.dataset.pathname = loc.pathname;
  }, [loc.pathname]);
  return null;
}

function seedDraft(): void {
  const file = new File(['x'], 'r.jpg', { type: 'image/jpeg' });
  Object.defineProperty(file, 'size', { value: 1024 });
  useBillDraftStore.getState().setDraft(file, {
    market_name: 'Lidl',
    bill_date: '2026-05-07',
    currency: 'EUR',
    total_amount: 10,
    items: [],
    raw_extracted_text: 'LIDL',
  });
}

function Providers({ children }: { children: ReactNode }): ReactElement {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('NewBillReview', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet('/sub-categories').reply(200, []);
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:fake'),
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      configurable: true,
    });
    useBillDraftStore.getState().clear();
  });

  afterEach(() => {
    mock.restore();
  });

  it('redirects to / when the store has no draft', async () => {
    render(
      <Providers>
        <MemoryRouter initialEntries={['/bills/review']}>
          <Routes>
            <Route path="/" element={<LocationProbe />} />
            <Route path="/bills/review" element={<NewBillReview />} />
          </Routes>
        </MemoryRouter>
      </Providers>
    );
    await waitFor(() => {
      expect(document.body.dataset.pathname).toBe('/');
    });
  });

  it('renders photo + editable fields when draft exists', () => {
    seedDraft();
    render(
      <Providers>
        <MemoryRouter initialEntries={['/bills/review']}>
          <Routes>
            <Route path="/bills/review" element={<NewBillReview />} />
          </Routes>
        </MemoryRouter>
      </Providers>
    );
    expect(screen.getByDisplayValue('Lidl')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-05-07')).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('Cancel opens a confirm dialog when fields are edited', async () => {
    seedDraft();
    render(
      <Providers>
        <MemoryRouter initialEntries={['/bills/review']}>
          <Routes>
            <Route path="/dashboard" element={<LocationProbe />} />
            <Route path="/bills/review" element={<NewBillReview />} />
          </Routes>
        </MemoryRouter>
      </Providers>
    );
    const marketInput = screen.getByDisplayValue('Lidl');
    await userEvent.clear(marketInput);
    await userEvent.type(marketInput, 'Rewe');

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(await screen.findByText(/discard this bill\?/i)).toBeInTheDocument();
  });

  it('Add item appends an empty row to the items table', async () => {
    seedDraft();
    render(
      <Providers>
        <MemoryRouter initialEntries={['/bills/review']}>
          <Routes>
            <Route path="/bills/review" element={<NewBillReview />} />
          </Routes>
        </MemoryRouter>
      </Providers>
    );

    expect(document.querySelector('[data-row-name="0"]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));
    await waitFor(() => {
      expect(document.querySelector('[data-row-name="0"]')).not.toBeNull();
    });
  });

  it('add → edit → delete loop shows + clears the totals banner', async () => {
    seedDraft();
    render(
      <Providers>
        <MemoryRouter initialEntries={['/bills/review']}>
          <Routes>
            <Route path="/bills/review" element={<NewBillReview />} />
          </Routes>
        </MemoryRouter>
      </Providers>
    );

    // Total is 10 from seedDraft, items are []. 0 vs 10 → banner visible.
    expect(await screen.findByText(/items don't match/i)).toBeInTheDocument();

    // Add a row, then set its final_price to 10 → banner clears.
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));
    // Both desktop row + mobile card render in JSDOM (md:hidden is CSS only),
    // so multiple inputs share the testid. Drive the first one — they all
    // map to the same store item.
    const priceInputs = await screen.findAllByTestId('item-final-price-0');
    const priceInput = priceInputs[0]!;
    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, '10');

    await waitFor(() => {
      expect(screen.queryByText(/items don't match/i)).toBeNull();
    });

    // Delete the row → banner returns. Both row + card expose their own
    // delete button; click the first.
    const deleteButtons = screen.getAllByRole('button', {
      name: /delete item/i,
    });
    await userEvent.click(deleteButtons[0]!);
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(await screen.findByText(/items don't match/i)).toBeInTheDocument();
  });
});
