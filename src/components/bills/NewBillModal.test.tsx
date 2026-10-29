import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { tokenStorage } from '@/auth/tokenStorage';
import { NewBillModal } from './NewBillModal';
import { useBillDraftStore } from '@/stores/billDraftStore';
import { Toaster } from '@/components/ui/toaster';
import '@/i18n';

function LocationProbe(): null {
  const loc = useLocation();
  useEffect(() => {
    document.body.dataset.pathname = loc.pathname;
  }, [loc.pathname]);
  return null;
}

function renderModal(onOpenChange = vi.fn()): {
  queryClient: QueryClient;
  onOpenChange: ReturnType<typeof vi.fn>;
} {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <MemoryRouter initialEntries={['/']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <NewBillModal open onOpenChange={onOpenChange} />
                <LocationProbe />
              </>
            }
          />
          <Route path="/bills/review" element={<LocationProbe />} />
        </Routes>
        <Toaster />
      </QueryClientProvider>
    </MemoryRouter>
  );
  return { queryClient, onOpenChange };
}

function makeFile(
  name = 'receipt.jpg',
  type = 'image/jpeg',
  size = 1024
): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('NewBillModal', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
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
    tokenStorage.clear({ broadcast: false });
    mock.restore();
    useBillDraftStore.getState().clear();
  });

  it('disables Send until a valid file is picked', async () => {
    renderModal();
    const send = screen.getByRole('button', { name: /send/i });
    expect(send).toBeDisabled();

    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeFile());

    expect(send).toBeEnabled();
  });

  it('shows inline error and keeps Send disabled for oversized files', async () => {
    renderModal();
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(
      input,
      makeFile('big.jpg', 'image/jpeg', 11 * 1024 * 1024)
    );

    expect(screen.getByText(/file too large/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('Cancel closes immediately when no file is selected', async () => {
    const { onOpenChange } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Cancel with a file opens the discard confirmation', async () => {
    renderModal();
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeFile());
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(
      await screen.findByText(/discard this photo\?/i)
    ).toBeInTheDocument();
  });

  it('successful upload writes to store and navigates to /bills/review', async () => {
    mock.onPost('/bills/parse-photo').reply(200, {
      market_name: 'Lidl',
      bill_date: '2026-05-07',
      currency: 'EUR',
      total_amount: 10,
      items: [],
      raw_extracted_text: 'LIDL',
    });

    renderModal();
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeFile());
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(document.body.dataset.pathname).toBe('/bills/review');
    });
    expect(useBillDraftStore.getState().parsed?.market_name).toBe('Lidl');
  });

  it('surfaces requestId on 502 response', async () => {
    mock.onPost('/bills/parse-photo').reply(502, {
      message: 'AI providers failed',
      requestId: 'req-123',
    });

    renderModal();
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeFile());
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    // Toast message contains the requestId
    await waitFor(() => {
      expect(screen.getByText(/req-123/)).toBeInTheDocument();
    });
  });

  it('on 401 (session over) closes the modal without a toast', async () => {
    tokenStorage.set(
      { access_token: 'at', expires_in: 900, token_type: 'Bearer' },
      { broadcast: false }
    );
    mock.onPost('/bills/parse-photo').reply(401, { message: 'Unauthorized' });
    mock.onPost('/auth/refresh').reply(401, { message: 'Unauthorized' });

    const { onOpenChange } = renderModal();
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeFile());
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(screen.queryByText(/session/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/upload failed/i)).not.toBeInTheDocument();
  });

  it('on 401 when the session survives (refresh 5xx) → uploadFailed toast, modal stays open', async () => {
    tokenStorage.set(
      { access_token: 'at', expires_in: 900, token_type: 'Bearer' },
      { broadcast: false }
    );
    mock.onPost('/bills/parse-photo').reply(401, { message: 'Unauthorized' });
    mock.onPost('/auth/refresh').reply(503, { message: 'Unavailable' });

    const { onOpenChange } = renderModal();
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('file input not rendered');
    await userEvent.upload(input, makeFile());
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText(/upload failed/i)).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(tokenStorage.getAccessToken()).toBe('at');
  });
});
