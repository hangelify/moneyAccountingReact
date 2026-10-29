import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { tokenStorage } from '@/auth/tokenStorage';
import { NewBillModal, __resetNewBillModalState } from './NewBillModal';
import { useBillDraftStore } from '@/stores/billDraftStore';
import { Toaster } from '@/components/ui/toaster';
import '@/i18n';
import {
  HouseholdTestProvider,
  makeHouseholdValue,
  TEST_HOUSEHOLDS,
} from '@/test/household';
import type { HouseholdContextValue } from '@/contexts/HouseholdContext';

const auth: { user: { id: string } | null } = { user: { id: 'u1' } };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.user, isAuthenticated: auth.user !== null }),
}));

function LocationProbe(): null {
  const loc = useLocation();
  useEffect(() => {
    document.body.dataset.pathname = loc.pathname;
  }, [loc.pathname]);
  return null;
}

function tree(
  value: HouseholdContextValue,
  queryClient: QueryClient,
  onOpenChange: () => void
): React.JSX.Element {
  return (
    <MemoryRouter initialEntries={['/']}>
      <QueryClientProvider client={queryClient}>
        <HouseholdTestProvider value={value}>
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
        </HouseholdTestProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function renderModal(
  onOpenChange = vi.fn(),
  value: HouseholdContextValue = makeHouseholdValue()
): {
  queryClient: QueryClient;
  onOpenChange: ReturnType<typeof vi.fn>;
  rerenderWith: (v: HouseholdContextValue) => void;
  unmount: () => void;
} {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const utils = render(tree(value, queryClient, onOpenChange));
  const rerenderWith = (v: HouseholdContextValue): void =>
    utils.rerender(tree(v, queryClient, onOpenChange));
  return { queryClient, onOpenChange, rerenderWith, unmount: utils.unmount };
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
    __resetNewBillModalState();
    auth.user = { id: 'u1' };
  });

  afterEach(() => {
    vi.useRealTimers();
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
    mock.onPost('/households/hh-1/bills/parse-photo').reply(200, {
      draft_id: 'd1',
      request_id: 'r1',
      duplicate: false,
      market_name: 'Lidl',
      bill_date: '2026-05-07',
      currency: 'EUR',
      total_amount: 10,
      items: [],
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
    mock.onPost('/households/hh-1/bills/parse-photo').reply(502, {
      message: 'AI providers failed',
      request_id: 'req-123',
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
    mock
      .onPost('/households/hh-1/bills/parse-photo')
      .reply(401, { message: 'Unauthorized' });
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
    mock
      .onPost('/households/hh-1/bills/parse-photo')
      .reply(401, { message: 'Unauthorized' });
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

  const URL_HH1 = '/households/hh-1/bills/parse-photo';
  const okBody = {
    draft_id: 'd1',
    request_id: 'r1',
    duplicate: false,
    market_name: 'Lidl',
    bill_date: '2026-05-07',
    currency: 'EUR',
    total_amount: 10,
    items: [],
  };

  async function pickAndSend(): Promise<void> {
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeFile());
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
  }

  it('hides the household picker with one household', () => {
    const one = TEST_HOUSEHOLDS.slice(0, 1);
    renderModal(vi.fn(), makeHouseholdValue({ households: one }));
    expect(screen.queryByLabelText('Household')).not.toBeInTheDocument();
  });

  it('shows it with two', () => {
    renderModal();
    expect(screen.getByLabelText('Household')).toBeInTheDocument();
  });

  it("switching the picker calls setActiveHouseholdId('hh-2')", async () => {
    const value = makeHouseholdValue();
    renderModal(vi.fn(), value);
    await userEvent.selectOptions(screen.getByLabelText('Household'), 'hh-2');
    expect(value.setActiveHouseholdId).toHaveBeenCalledWith('hh-2');
  });

  it('sends to /households/hh-1/bills/parse-photo and navigates to review', async () => {
    mock.onPost(URL_HH1).reply(200, okBody);
    renderModal();
    await pickAndSend();
    await waitFor(() => {
      expect(document.body.dataset.pathname).toBe('/bills/review');
    });
    expect(useBillDraftStore.getState().mode).toBe('confirm');
  });

  it('stores the hid the photo was sent to', async () => {
    mock
      .onPost(URL_HH1)
      .reply(() => new Promise((r) => setTimeout(() => r([200, okBody]), 50)));
    const { rerenderWith } = renderModal();
    await pickAndSend();
    rerenderWith(
      makeHouseholdValue({ activeHousehold: TEST_HOUSEHOLDS[1] ?? null })
    );
    await waitFor(() => {
      expect(document.body.dataset.pathname).toBe('/bills/review');
    });
    expect(useBillDraftStore.getState().hid).toBe('hh-1');
  });

  it('shows the duplicate toast when duplicate is true', async () => {
    mock.onPost(URL_HH1).reply(200, { ...okBody, duplicate: true });
    renderModal();
    await pickAndSend();
    expect(
      await screen.findByText(/already scanned this receipt/i)
    ).toBeInTheDocument();
  });

  it('shows a bad-photo message inline and keeps the photo', async () => {
    mock
      .onPost(URL_HH1)
      .reply(415, { message: 'HEIC is not supported', request_id: null });
    renderModal();
    await pickAndSend();
    expect(
      await screen.findByText('HEIC is not supported')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
    expect(screen.getByText('receipt.jpg')).toBeInTheDocument();
  });

  it('falls back to review in create mode on 422 with parsed', async () => {
    mock.onPost(URL_HH1).reply(422, {
      message: 'Could not save',
      request_id: 'r-5',
      parsed: { ...okBody, draft_id: '' },
    });
    renderModal();
    await pickAndSend();
    await waitFor(() => {
      expect(document.body.dataset.pathname).toBe('/bills/review');
    });
    const st = useBillDraftStore.getState();
    expect(st.mode).toBe('create');
    expect(st.draftId).toBeNull();
    expect(st.hid).toBe('hh-1');
    expect(
      await screen.findByText(/draft could not be saved/i)
    ).toBeInTheDocument();
  });

  it('shows a countdown and re-enables Send', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mock
      .onPost(URL_HH1)
      .reply(429, { message: 'Slow down' }, { 'retry-after': '2' });
    renderModal();
    await pickAndSend();
    const btn = await screen.findByRole('button', { name: 'Try again in 2 s' });
    expect(btn).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  it('keeps Send disabled after reopening during a countdown', async () => {
    mock
      .onPost(URL_HH1)
      .reply(429, { message: 'Slow down' }, { 'retry-after': '30' });
    const first = renderModal();
    await pickAndSend();
    await screen.findByRole('button', { name: /try again in/i });
    cleanup();
    first.onOpenChange.mockClear();
    renderModal();
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeFile());
    expect(
      screen.getByRole('button', { name: /try again in/i })
    ).toBeDisabled();
  });

  it('disables scanning when recognition is not available', async () => {
    mock
      .onPost(URL_HH1)
      .reply(503, { message: 'Photo recognition is not available' });
    renderModal();
    await pickAndSend();
    expect(
      await screen.findByText('Photo recognition is not available')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('shows the reference code', async () => {
    mock
      .onPost(URL_HH1)
      .reply(502, { message: 'Providers failed', request_id: 'r-9' });
    renderModal();
    await pickAndSend();
    expect(await screen.findByText(/Reference: r-9/)).toBeInTheDocument();
  });

  it('cancel aborts the upload and keeps the photo', async () => {
    mock.onPost(URL_HH1).reply(
      (config) =>
        new Promise((_resolve, reject) => {
          config.signal?.addEventListener?.('abort', () =>
            reject(
              Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' })
            )
          );
        })
    );
    renderModal();
    await pickAndSend();
    const cancelButtons = await screen.findAllByRole('button', {
      name: 'Cancel',
    });
    const active = cancelButtons.find(
      (b) => !(b as HTMLButtonElement).disabled
    );
    await userEvent.click(active!);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
    });
    expect(screen.getByText('receipt.jpg')).toBeInTheDocument();
    expect(screen.queryByText(/upload failed/i)).not.toBeInTheDocument();
  });

  it('drops a late reply that arrives after unmount', async () => {
    let release: () => void = () => undefined;
    mock.onPost(URL_HH1).reply(
      () =>
        new Promise((resolve) => {
          release = () => resolve([200, okBody]);
        })
    );
    const { unmount } = renderModal();
    await pickAndSend();
    await waitFor(() => expect(mock.history.post).toHaveLength(1));

    unmount();
    await act(async () => {
      release();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(useBillDraftStore.getState().parsed).toBeNull();
    expect(document.body.dataset.pathname).not.toBe('/bills/review');
  });

  it('aborts the upload when the signed-in user changes', async () => {
    let signal: AbortSignal | undefined;
    mock.onPost(URL_HH1).reply((config) => {
      signal = config.signal as AbortSignal | undefined;
      return new Promise(() => undefined);
    });
    const { rerenderWith } = renderModal();
    await pickAndSend();
    await waitFor(() => expect(signal).toBeDefined());
    expect(signal?.aborted).toBe(false);

    auth.user = { id: 'u2' };
    rerenderWith(makeHouseholdValue());

    await waitFor(() => expect(signal?.aborted).toBe(true));
    expect(useBillDraftStore.getState().parsed).toBeNull();
  });

  it('disables Send until households are loaded', async () => {
    renderModal(
      vi.fn(),
      makeHouseholdValue({ status: 'loading', activeHousehold: null })
    );
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, makeFile());
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('shows the no-household note when the list is empty', () => {
    renderModal(
      vi.fn(),
      makeHouseholdValue({
        status: 'empty',
        households: [],
        activeHousehold: null,
      })
    );
    expect(screen.getByText(/No household available/i)).toBeInTheDocument();
  });

  it('offers a retry when households failed to load', async () => {
    const value = makeHouseholdValue({
      status: 'error',
      households: [],
      activeHousehold: null,
    });
    renderModal(vi.fn(), value);
    expect(
      screen.getByText('Could not load your households.')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(value.refetch).toHaveBeenCalled();
  });

  it('calls handleForbidden on 403', async () => {
    mock.onPost(URL_HH1).reply(403, { message: 'Forbidden' });
    const value = makeHouseholdValue();
    renderModal(vi.fn(), value);
    await pickAndSend();
    await waitFor(() => {
      expect(value.handleForbidden).toHaveBeenCalledWith(expect.any(Error));
    });
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });
});
