import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
import { BillEventsContext } from '@/hooks/useBillBatch';
import type { BillBatch } from '@/types/bills';
import { prepareBillImage } from '@/lib/resizeImage';

vi.mock('@/lib/resizeImage', () => ({
  prepareBillImage: vi.fn((f: File) => Promise.resolve(f)),
}));

const trackBatch = vi.fn();

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
          <BillEventsContext.Provider
            value={{ waitForOpen: () => Promise.resolve(), trackBatch }}
          >
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
          </BillEventsContext.Provider>
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
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    let urlCount = 0;
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => `blob:${++urlCount}`),
      configurable: true,
    });
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
    });
    useBillDraftStore.getState().clear();
    __resetNewBillModalState();
    auth.user = { id: 'u1' };
    trackBatch.mockReset();
  });

  afterEach(() => {
    vi.mocked(prepareBillImage).mockImplementation((f: File) =>
      Promise.resolve(f)
    );
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
    // Size is checked after resizing, on Send.
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText(/file too large/i)).toBeInTheDocument();
    expect(mock.history.post).toHaveLength(0);
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

  it('shows the timeout copy when recognition times out', async () => {
    mock.onPost(URL_HH1).timeout();
    renderModal();
    await pickAndSend();
    expect(
      await screen.findByText(
        'Recognition is taking too long. Try again in a moment — a repeat send continues the same draft.'
      )
    ).toBeInTheDocument();
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

  describe('several photos', () => {
    const BATCH_URL = '/households/hh-1/bills/parse-photos';
    const batch = (total: number): BillBatch => ({
      batch_id: 'b1',
      created_at: '2026-11-03T10:00:00Z',
      total,
      completed: false,
      items: [],
    });
    const files = (n: number): File[] =>
      Array.from({ length: n }, (_, i) => makeFile(`p${i + 1}.jpg`));
    const fileInput = (): HTMLInputElement => {
      const input =
        document.querySelector<HTMLInputElement>('input[type="file"]');
      if (!input) throw new Error('file input not rendered');
      return input;
    };
    const sentNames = (i: number): string[] =>
      (mock.history.post[i]?.data as FormData)
        .getAll('images')
        .map((f) => (f as File).name);
    const tile = (i: number): HTMLElement => {
      const el = screen.getAllByRole('listitem')[i];
      if (!el) throw new Error(`no tile ${i}`);
      return el;
    };
    const send = (): HTMLElement =>
      screen.getByRole('button', { name: /send|try again in/i });
    async function advanceUntil(cond: () => boolean): Promise<void> {
      for (let i = 0; i < 40 && !cond(); i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
      }
    }

    it('three photos post to parse-photos in order, track the batch, close the modal and toast', async () => {
      mock.onPost(BATCH_URL).reply(202, batch(3));
      const { onOpenChange } = renderModal();
      await userEvent.upload(fileInput(), files(3));
      expect(screen.getAllByRole('listitem')).toHaveLength(4); // + add tile
      await userEvent.click(send());

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(mock.history.post).toHaveLength(1);
      expect(sentNames(0)).toEqual(['p1.jpg', 'p2.jpg', 'p3.jpg']);
      expect(trackBatch).toHaveBeenCalledWith(batch(3), 'hh-1', {
        0: 'blob:1',
        1: 'blob:2',
        2: 'blob:3',
      });
      expect(revokeObjectURL).not.toHaveBeenCalled();
      expect(
        await screen.findByText(
          'Reading 3 receipts. Follow progress from the bell.'
        )
      ).toBeInTheDocument();
      expect(document.body.dataset.pathname).not.toBe('/bills/review');
    });

    it('prepares photos one at a time, in selection order', async () => {
      mock.onPost(BATCH_URL).reply(202, batch(3));
      const pending: { file: File; resolve: (f: File) => void }[] = [];
      vi.mocked(prepareBillImage).mockImplementation(
        (file: File) =>
          new Promise<File>((resolve) => pending.push({ file, resolve }))
      );
      const { onOpenChange } = renderModal();
      await userEvent.upload(fileInput(), files(3));
      await userEvent.click(send());

      expect(await screen.findByText('Uploading photos…')).toBeInTheDocument();
      for (let i = 0; i < 3; i++) {
        await waitFor(() => expect(pending).toHaveLength(i + 1));
        // The next photo has not started while this one is in progress.
        await act(async () => {
          await new Promise((r) => setTimeout(r, 20));
        });
        expect(pending).toHaveLength(i + 1);
        const current = pending[i];
        if (!current) throw new Error('no pending prepare');
        expect(current.file.name).toBe(`p${i + 1}.jpg`);
        current.resolve(current.file);
      }

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(sentNames(0)).toEqual(['p1.jpg', 'p2.jpg', 'p3.jpg']);
    });

    it('selecting more than 20 keeps 20 and shows tooManyFiles', async () => {
      renderModal();
      await userEvent.upload(fileInput(), files(21));
      expect(
        screen.getAllByRole('button', { name: 'Remove photo' })
      ).toHaveLength(20);
      expect(screen.getByText('Up to 20 photos at a time')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Add more' })
      ).not.toBeInTheDocument();
    });

    it('a HEIC file marks its thumbnail and disables Send until removed', async () => {
      const user = userEvent.setup({ applyAccept: false });
      renderModal();
      await user.upload(fileInput(), [
        makeFile('a.jpg'),
        makeFile('b.heic', 'image/heic'),
        makeFile('c.jpg'),
      ]);
      expect(
        within(tile(1)).getByText(/unsupported format/i)
      ).toBeInTheDocument();
      expect(send()).toBeDisabled();

      await user.click(
        within(tile(1)).getByRole('button', { name: 'Remove photo' })
      );
      expect(screen.queryByText(/unsupported format/i)).not.toBeInTheDocument();
      expect(send()).toBeEnabled();
    });

    it('400 "File 1: …" (0-based) marks the second photo and keeps all photos', async () => {
      mock
        .onPost(BATCH_URL)
        .reply(400, { message: 'File 1: image is unreadable' });
      renderModal();
      await userEvent.upload(fileInput(), files(3));
      await userEvent.click(send());

      expect(
        await within(tile(1)).findByText('File 1: image is unreadable')
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole('button', { name: 'Remove photo' })
      ).toHaveLength(3);
      expect(send()).toBeDisabled();
    });

    it('503 busy retries the same files after Retry-After and succeeds on the second try', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mock
        .onPost(BATCH_URL)
        .replyOnce(503, { message: 'Busy' }, { 'retry-after': '5' })
        .onPost(BATCH_URL)
        .replyOnce(202, batch(2));
      const { onOpenChange } = renderModal();
      await userEvent.upload(fileInput(), files(2));
      await userEvent.click(send());

      expect(
        await screen.findByText('Server busy, retrying…')
      ).toBeInTheDocument();
      expect(mock.history.post).toHaveLength(1);
      await advanceUntil(() => mock.history.post.length >= 2);

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(mock.history.post).toHaveLength(2);
      expect(sentNames(1)).toEqual(sentNames(0));
      expect(sentNames(1)).toEqual(['p1.jpg', 'p2.jpg']);
      expect(trackBatch).toHaveBeenCalledTimes(1);
    });

    it('503 busy three times ends in a countdown on Send', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mock
        .onPost(BATCH_URL)
        .reply(503, { message: 'Busy' }, { 'retry-after': '5' });
      renderModal();
      await userEvent.upload(fileInput(), files(2));
      await userEvent.click(send());

      await advanceUntil(() => mock.history.post.length >= 3);
      expect(
        await screen.findByRole('button', { name: /try again in/i })
      ).toBeDisabled();
      expect(mock.history.post).toHaveLength(3);
      expect(
        screen.getByText('Try again later, or send fewer photos.')
      ).toBeInTheDocument();
      expect(trackBatch).not.toHaveBeenCalled();
    });

    it('503 disabled switches to single-photo mode keeping the first photo', async () => {
      mock
        .onPost(BATCH_URL)
        .reply(503, { message: 'Batch photo parsing is disabled' });
      renderModal();
      expect(fileInput()).toHaveAttribute('multiple');
      await userEvent.upload(fileInput(), files(3));
      await userEvent.click(send());

      expect(
        await screen.findByText(
          'Several photos at once is not available right now. Send one photo at a time.'
        )
      ).toBeInTheDocument();
      expect(fileInput()).not.toHaveAttribute('multiple');
      expect(
        screen.getAllByRole('button', { name: 'Remove photo' })
      ).toHaveLength(1);
      expect(screen.getByText('p1.jpg')).toBeInTheDocument();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:2');
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:3');
      expect(revokeObjectURL).not.toHaveBeenCalledWith('blob:1');
      expect(send()).toBeEnabled();
    });

    it('429 budget disables photo upload for the session', async () => {
      mock.onPost(BATCH_URL).reply(429, {
        message: 'Daily AI budget exceeded. Add the bill manually.',
      });
      renderModal();
      await userEvent.upload(fileInput(), files(2));
      await userEvent.click(send());

      expect(
        await screen.findByText(
          'Daily AI budget exceeded. Add the bill manually.'
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText('You can still enter receipts manually.')
      ).toBeInTheDocument();
      expect(send()).toBeDisabled();

      cleanup();
      renderModal();
      await userEvent.upload(fileInput(), files(1));
      expect(send()).toBeDisabled();
    });

    it('photo 11 over 10 MB after resize is marked and nothing is sent', async () => {
      renderModal();
      const picked = files(12);
      picked[10] = makeFile('p11.jpg', 'image/jpeg', 11 * 1024 * 1024);
      await userEvent.upload(fileInput(), picked);
      await userEvent.click(send());

      expect(
        await within(tile(10)).findByText(/file too large/i)
      ).toBeInTheDocument();
      expect(mock.history.post).toHaveLength(0);
      expect(send()).toBeDisabled();
    });
  });
});
