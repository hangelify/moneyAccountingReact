import '@/i18n';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode, type ReactElement, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient } from '@/auth/apiClient';
import { NewBillReview } from './NewBillReview';
import { useBillDraftStore } from '@/stores/billDraftStore';
import { HouseholdTestProvider, makeHouseholdValue } from '@/test/household';
import type { ParsePhotoResponse } from '@/types/bills';

// A real parse-photo reply (trimmed to a few items).
const RESPONSE: ParsePhotoResponse = {
  draft_id: 'c228c717-7dba-4f9f-8d30-3beb165d4c5d',
  market_name: 'N-1 Supermarket',
  bill_date: null,
  currency: 'MDL',
  total_amount: 1192.21,
  items: [
    {
      id: '4da63c69-c366-4697-a7c3-49c07c166745',
      name: 'Lapte ultrapa',
      quantity: 3,
      unit: 'piece',
      weight_kg: null,
      price_per_kg: null,
      final_price: 82.5,
      sub_category: {
        id: '5e168e36-cbe3-409a-acb9-af77174a60d6',
        name: 'milk',
        category_name: 'Dairy',
      },
      category_confidence: 0.95,
      category_reasoning: 'Lapte means milk in Romanian.',
    },
    {
      id: '7343ff6a-e221-4609-b390-c20380df01b6',
      name: 'Carnaciori Ki',
      quantity: null,
      unit: 'kg',
      weight_kg: 0.538,
      price_per_kg: 164.3,
      final_price: 88.39,
      sub_category: {
        id: '853dc166-efa7-4aef-a960-5c6475f4dc0b',
        name: 'sausages',
        category_name: 'Meat & Fish',
      },
      category_confidence: 0.92,
      category_reasoning: 'Carnaciori means sausages in Romanian.',
    },
    {
      id: '19490344-bf5e-4d70-8621-686378975f5d',
      name: 'Rubalaj bio (',
      quantity: 2,
      unit: 'piece',
      weight_kg: null,
      price_per_kg: null,
      final_price: 3,
      sub_category: null,
      category_confidence: 0.3,
      category_reasoning: 'No confident match.',
    },
  ],
  request_id: 'c5004fd6-2c02-4a35-9615-90f88c64a03b',
  duplicate: false,
};

const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Providers({ children }: { children: ReactNode }): ReactElement {
  return (
    <QueryClientProvider client={client}>
      <HouseholdTestProvider value={makeHouseholdValue()}>
        {children}
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
}

describe('NewBillReview under StrictMode', () => {
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

  it('renders the scanned items in the table', () => {
    useBillDraftStore.getState().setDraft({
      file: new File(['x'], 'r.jpg', { type: 'image/jpeg' }),
      parsed: RESPONSE,
      hid: 'hh-1',
      mode: 'confirm',
    });
    render(
      <StrictMode>
        <Providers>
          <MemoryRouter initialEntries={['/bills/review']}>
            <Routes>
              <Route path="/" element={<p>home</p>} />
              <Route path="/bills/review" element={<NewBillReview />} />
            </Routes>
          </MemoryRouter>
        </Providers>
      </StrictMode>
    );
    expect(screen.queryByText('home')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('N-1 Supermarket')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('Carnaciori Ki').length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByDisplayValue('Rubalaj bio (').length).toBeGreaterThan(
      0
    );
  });

  it('still clears the draft when the page really unmounts', async () => {
    useBillDraftStore.getState().setDraft({
      file: new File(['x'], 'r.jpg', { type: 'image/jpeg' }),
      parsed: RESPONSE,
      hid: 'hh-1',
      mode: 'confirm',
    });
    const { unmount } = render(
      <StrictMode>
        <Providers>
          <MemoryRouter initialEntries={['/bills/review']}>
            <Routes>
              <Route path="/bills/review" element={<NewBillReview />} />
            </Routes>
          </MemoryRouter>
        </Providers>
      </StrictMode>
    );
    expect(useBillDraftStore.getState().file).not.toBeNull();
    unmount();
    await waitFor(() => {
      expect(useBillDraftStore.getState().file).toBeNull();
    });
  });
});
