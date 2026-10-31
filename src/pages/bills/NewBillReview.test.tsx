import '@/i18n';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { apiClient } from '@/auth/apiClient';
import { NewBillReview } from './NewBillReview';
import { useBillDraftStore } from '@/stores/billDraftStore';
import { Toaster } from '@/components/ui/toaster';
import { HouseholdTestProvider, makeHouseholdValue } from '@/test/household';
import { buildConfirmPayload, todayIso } from './buildConfirmPayload';
import type { ParsedBillItem } from '@/types/bills';

function LocationProbe(): null {
  const loc = useLocation();
  useEffect(() => {
    document.body.dataset.pathname = loc.pathname;
  }, [loc.pathname]);
  return null;
}

const CAT = { id: 's1', name: 'Dairy', category_name: 'Food' };

function seedDraft(
  opts: {
    hid?: string;
    mode?: 'confirm' | 'create';
    items?: ParsedBillItem[];
  } = {}
): void {
  const file = new File(['x'], 'r.jpg', { type: 'image/jpeg' });
  Object.defineProperty(file, 'size', { value: 1024 });
  useBillDraftStore.getState().setDraft({
    file,
    parsed: {
      draft_id: 'd1',
      market_name: 'Lidl',
      bill_date: '2026-05-07',
      currency: 'EUR',
      total_amount: 10,
      items: opts.items ?? [],
    },
    hid: opts.hid ?? 'hh-1',
    mode: opts.mode ?? 'confirm',
  });
}

const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const household = makeHouseholdValue();

function Providers({ children }: { children: ReactNode }): ReactElement {
  return (
    <QueryClientProvider client={client}>
      <HouseholdTestProvider value={household}>
        {children}
        <Toaster />
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
}

describe('NewBillReview', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet('/households/hh-1/sub-categories').reply(200, []);
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

  function renderReview(): void {
    render(
      <Providers>
        <MemoryRouter initialEntries={['/bills/review']}>
          <Routes>
            <Route path="/dashboard" element={<LocationProbe />} />
            <Route path="/bills/confirmed" element={<LocationProbe />} />
            <Route path="/bills/review" element={<NewBillReview />} />
          </Routes>
        </MemoryRouter>
      </Providers>
    );
  }

  const item = (sub: typeof CAT | null): ParsedBillItem => ({
    id: 'i1',
    name: 'Milk',
    quantity: 1,
    unit: 'piece',
    weight_kg: null,
    price_per_kg: null,
    final_price: 10,
    sub_category: sub,
    category_confidence: 1,
  });

  const saveButton = (): HTMLElement =>
    screen.getByRole('button', { name: /^save$/i });

  describe('saving', () => {
    beforeEach(() => {
      delete document.body.dataset.pathname;
      vi.mocked(household.handleForbidden).mockClear();
    });

    it('confirms the draft with the built payload', async () => {
      seedDraft({ items: [item(CAT)] });
      const expected = buildConfirmPayload(
        useBillDraftStore.getState().edits,
        todayIso()
      );
      mock.onPost('/households/hh-1/bills/d1/confirm').reply(201, {});
      renderReview();
      await userEvent.click(saveButton());
      await waitFor(() => {
        expect(document.body.dataset.pathname).toBe('/bills/confirmed');
      });
      expect(JSON.parse(mock.history.post[0]!.data as string)).toEqual(
        expected
      );
      expect(useBillDraftStore.getState().file).toBeNull();
      expect(await screen.findByText('Bill saved')).toBeInTheDocument();
    });

    it('invalidates the household bills and markets caches after save', async () => {
      const spy = vi.spyOn(client, 'invalidateQueries');
      seedDraft({ items: [item(CAT)] });
      mock.onPost('/households/hh-1/bills/d1/confirm').reply(201, {});
      renderReview();
      await userEvent.click(saveButton());
      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith({
          queryKey: ['households', 'hh-1', 'bills'],
        });
      });
      expect(spy).toHaveBeenCalledWith({
        queryKey: ['households', 'hh-1', 'markets'],
      });
      expect(spy).toHaveBeenCalledWith({
        queryKey: ['households', 'hh-1', 'dashboard'],
      });
    });

    it('create mode posts to the household bills and gates Save on categories', async () => {
      seedDraft({ mode: 'create', items: [item(null)] });
      mock.onPost('/households/hh-1/bills').reply(201, {});
      renderReview();
      expect(saveButton()).toBeDisabled();
      expect(
        screen.getByText('Pick a category for every line before saving.')
      ).toBeInTheDocument();
      act(() => {
        useBillDraftStore.getState().updateItem(0, { sub_category: CAT });
      });
      await waitFor(() => {
        expect(saveButton()).toBeEnabled();
      });
      await userEvent.click(saveButton());
      await waitFor(() => {
        expect(document.body.dataset.pathname).toBe('/bills/confirmed');
      });
      expect(mock.history.post[0]!.url).toBe('/households/hh-1/bills');
    });

    it('create mode shows the shop-name hint', () => {
      seedDraft({ mode: 'create', items: [item(CAT)] });
      renderReview();
      expect(
        screen.getByText("The shop name can't be saved for this bill.")
      ).toBeInTheDocument();
    });

    it('disables Save when the draft belongs to another household', () => {
      seedDraft({ hid: 'hh-2', items: [item(CAT)] });
      renderReview();
      expect(
        screen.getByText(/This draft belongs to Family Budget\./)
      ).toBeInTheDocument();
      expect(saveButton()).toBeDisabled();
    });

    it("doesn't show a raw id when the draft's household is unknown", () => {
      seedDraft({ hid: 'hh-gone', items: [item(CAT)] });
      renderReview();
      expect(
        screen.getByText(
          'This draft belongs to a household you can no longer access.'
        )
      ).toBeInTheDocument();
      expect(screen.queryByText(/hh-gone/)).toBeNull();
      expect(saveButton()).toBeDisabled();
    });

    it('renders repeated validation messages without a key clash', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      seedDraft({ items: [item(CAT)] });
      mock
        .onPost('/households/hh-1/bills/d1/confirm')
        .reply(400, { message: ['bad line', 'bad line'] });
      renderReview();
      await userEvent.click(saveButton());
      await waitFor(() => {
        expect(screen.getAllByText('bad line')).toHaveLength(2);
      });
      expect(consoleError).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('shows validation messages on 400 and keeps the store', async () => {
      seedDraft({ items: [item(CAT)] });
      mock
        .onPost('/households/hh-1/bills/d1/confirm')
        .reply(400, { message: ['total_amount must be positive'] });
      renderReview();
      await userEvent.click(saveButton());
      expect(
        await screen.findByText('total_amount must be positive')
      ).toBeInTheDocument();
      expect(useBillDraftStore.getState().file).not.toBeNull();
    });

    it('404 clears and goes to /dashboard', async () => {
      seedDraft({ items: [item(CAT)] });
      mock.onPost('/households/hh-1/bills/d1/confirm').reply(404, {});
      renderReview();
      await userEvent.click(saveButton());
      await waitFor(() => {
        expect(document.body.dataset.pathname).toBe('/dashboard');
      });
      expect(
        await screen.findByText('This draft no longer exists.')
      ).toBeInTheDocument();
      expect(useBillDraftStore.getState().file).toBeNull();
    });

    it('409 clears and goes to /bills/confirmed', async () => {
      seedDraft({ items: [item(CAT)] });
      mock.onPost('/households/hh-1/bills/d1/confirm').reply(409, {});
      renderReview();
      await userEvent.click(saveButton());
      await waitFor(() => {
        expect(document.body.dataset.pathname).toBe('/bills/confirmed');
      });
      expect(
        await screen.findByText('This bill was already confirmed.')
      ).toBeInTheDocument();
      expect(useBillDraftStore.getState().file).toBeNull();
    });

    it('403 calls handleForbidden, clears and goes to /dashboard', async () => {
      seedDraft({ items: [item(CAT)] });
      mock.onPost('/households/hh-1/bills/d1/confirm').reply(403, {});
      renderReview();
      await userEvent.click(saveButton());
      await waitFor(() => {
        expect(document.body.dataset.pathname).toBe('/dashboard');
      });
      expect(household.handleForbidden).toHaveBeenCalledTimes(1);
      expect(useBillDraftStore.getState().file).toBeNull();
    });

    it('shows a toast and keeps edits on other errors', async () => {
      seedDraft({ items: [item(CAT)] });
      mock.onPost('/households/hh-1/bills/d1/confirm').reply(500, {});
      renderReview();
      await userEvent.click(saveButton());
      expect(
        await screen.findByText('Could not save the bill. Please try again.')
      ).toBeInTheDocument();
      expect(useBillDraftStore.getState().file).not.toBeNull();
    });

    it('disables Save while saving', async () => {
      seedDraft({ items: [item(CAT)] });
      mock
        .onPost('/households/hh-1/bills/d1/confirm')
        .reply(() => new Promise(() => undefined));
      renderReview();
      await userEvent.click(saveButton());
      await waitFor(() => {
        expect(saveButton()).toBeDisabled();
      });
    });
  });

  it('Cancel is disabled while saving', async () => {
    seedDraft({ items: [item(CAT)] });
    mock
      .onPost('/households/hh-1/bills/d1/confirm')
      .reply(() => new Promise(() => undefined));
    renderReview();
    await userEvent.click(saveButton());
    const cancel = screen.getByRole('button', { name: /cancel/i });
    await waitFor(() => {
      expect(cancel).toBeDisabled();
    });
    expect(mock.history.delete).toHaveLength(0);
  });

  describe('discarding', () => {
    beforeEach(() => {
      delete document.body.dataset.pathname;
    });

    it('Cancel without edits deletes the draft', async () => {
      seedDraft();
      mock.onDelete('/households/hh-1/bills/d1').reply(204);
      renderReview();
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
      await waitFor(() => {
        expect(document.body.dataset.pathname).toBe('/dashboard');
      });
      expect(mock.history.delete).toHaveLength(1);
      expect(useBillDraftStore.getState().file).toBeNull();
    });

    it('Discard after edits deletes the draft', async () => {
      seedDraft();
      mock.onDelete('/households/hh-1/bills/d1').reply(204);
      renderReview();
      const market = screen.getByDisplayValue('Lidl');
      await userEvent.clear(market);
      await userEvent.type(market, 'Rewe');
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
      await userEvent.click(
        await screen.findByRole('button', { name: /^discard$/i })
      );
      await waitFor(() => {
        expect(mock.history.delete).toHaveLength(1);
      });
      expect(mock.history.delete[0]!.url).toBe('/households/hh-1/bills/d1');
    });

    it('Cancel in create mode sends no DELETE', async () => {
      seedDraft({ mode: 'create' });
      renderReview();
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
      await waitFor(() => {
        expect(document.body.dataset.pathname).toBe('/dashboard');
      });
      expect(mock.history.delete).toHaveLength(0);
    });
  });
});
