import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import type { ReactElement } from 'react';
import { apiClient } from '@/auth/apiClient';
import type { DraftBillDto, ParseErrorCode } from '@/types/bills';
import '@/i18n';
import { HouseholdTestProvider, makeHouseholdValue } from '@/test/household';
import {
  __resetBillBatchStore,
  useBillBatchStore,
} from '@/stores/billBatchStore';
import { FailedBillsGroup } from './FailedBillsGroup';

const toastMock = vi.fn<(arg: Record<string, unknown>) => void>();
vi.mock('@/hooks/use-toast', () => ({
  toast: (arg: Record<string, unknown>) => {
    toastMock(arg);
  },
}));

function at<T>(list: T[], i: number): T {
  const v = list[i];
  if (v === undefined) throw new Error(`missing item ${i}`);
  return v;
}

function Loc(): ReactElement {
  const l = useLocation();
  return <span data-testid="loc">{l.pathname}</span>;
}

function failed(
  id: string,
  code: ParseErrorCode | null,
  message: string
): DraftBillDto {
  return {
    id,
    bill_date: '2026-05-19',
    total_amount: 0,
    amount_mismatch: false,
    created_at: '2026-05-19T10:00:00Z',
    status: 'failed',
    bill_date_inferred: false,
    items: [],
    parse_error_code: code,
    parse_error_message: message,
  };
}

const paged = (rows: DraftBillDto[]): [number, unknown] => [
  200,
  {
    data: rows,
    meta: { total: rows.length, page: 1, limit: 20, total_pages: 1 },
  },
];

const BATCH = {
  batch_id: 'b9',
  created_at: '2026-05-19T10:00:00Z',
  total: 1,
  completed: false,
  items: [],
};

describe('FailedBillsGroup', () => {
  let mock: MockAdapter;
  let qc: QueryClient;
  let handleForbidden: Mock<(err?: unknown) => Promise<void>>;
  beforeEach(() => {
    toastMock.mockReset();
    mock = new MockAdapter(apiClient);
    mock.onGet(/\/bills\/drafts\/[^/]+\/image$/).reply(200, new Blob(['x']));
    handleForbidden = vi.fn().mockResolvedValue(undefined);
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:x'),
      revokeObjectURL: vi.fn(),
    });
    __resetBillBatchStore();
  });
  afterEach(() => mock.restore());

  function renderIt(): void {
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={qc}>
        <HouseholdTestProvider value={makeHouseholdValue({ handleForbidden })}>
          <MemoryRouter>
            <Loc />
            <FailedBillsGroup />
          </MemoryRouter>
        </HouseholdTestProvider>
      </QueryClientProvider>
    );
  }

  const two = (): void => {
    mock
      .onGet('/households/hh-1/bills/drafts')
      .reply(() =>
        paged([
          failed('f1', 'not_a_receipt', 'This is not a receipt'),
          failed('f2', 'ai_failed', 'The AI could not read it'),
        ])
      );
  };

  it('is hidden when the failed list is empty', async () => {
    mock.onGet('/households/hh-1/bills/drafts').reply(() => paged([]));
    renderIt();
    await waitFor(() => expect(mock.history.get.length).toBeGreaterThan(0));
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByText(/couldn't read/i)).toBeNull();
  });

  it('shows the count and each message as is', async () => {
    two();
    renderIt();
    expect(
      await screen.findByText("Couldn't read these receipts (2)")
    ).toBeInTheDocument();
    expect(screen.getByText('This is not a receipt')).toBeInTheDocument();
    expect(screen.getByText('The AI could not read it')).toBeInTheDocument();
    expect(mock.history.get[0]?.params).toMatchObject({ status: 'failed' });
  });

  it('not_a_receipt leads with Enter manually; ai_failed generic leads with Retry', async () => {
    two();
    renderIt();
    await screen.findByText('This is not a receipt');
    const cards = screen.getAllByRole('listitem');
    const btns = (i: number): string[] =>
      Array.from(at(cards, i).querySelectorAll('button'))
        .map((b) => b.textContent)
        .filter(Boolean);
    expect(btns(0)).toEqual(['Enter manually', 'Delete']);
    expect(btns(1)).toEqual(['Retry', 'Enter manually', 'Delete']);
  });

  it('budget message disables Retry labelled Retry tomorrow', async () => {
    mock
      .onGet('/households/hh-1/bills/drafts')
      .reply(() =>
        paged([failed('f1', 'ai_failed', 'Daily AI budget exceeded')])
      );
    renderIt();
    const btn = await screen.findByRole('button', { name: 'Retry tomorrow' });
    expect(btn).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Enter manually' })
    ).toBeEnabled();
  });

  it('Retry 202 tracks the new batch with the photo and invalidates drafts', async () => {
    two();
    mock.onPost('/households/hh-1/bills/f2/retry').reply(202, BATCH);
    renderIt();
    await screen.findByText('The AI could not read it');
    await waitFor(() =>
      expect(
        qc.getQueryData(['households', 'hh-1', 'bill-image', 'f2'])
      ).toBeDefined()
    );
    const before = mock.history.get.filter((r) =>
      r.url?.endsWith('/drafts')
    ).length;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Reading the receipt again. Follow progress from the bell.',
        })
      )
    );
    await waitFor(() =>
      expect(
        mock.history.get.filter((r) => r.url?.endsWith('/drafts')).length
      ).toBeGreaterThan(before)
    );
    const tracked = useBillBatchStore.getState().batches[0];
    expect(tracked?.batchId).toBe('b9');
    expect(tracked?.thumbnails).toEqual({ 0: 'blob:x' });
  });

  it('Retry 409 toasts gone and refetches', async () => {
    two();
    mock.onPost('/households/hh-1/bills/f2/retry').reply(409, { message: 'x' });
    renderIt();
    await screen.findByText('The AI could not read it');
    const before = mock.history.get.length;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'This receipt was already handled. The list is refreshed.',
        })
      )
    );
    await waitFor(() =>
      expect(mock.history.get.length).toBeGreaterThan(before)
    );
  });

  it('Retry 429 toasts the message with seconds and keeps the card', async () => {
    two();
    mock.onPost('/households/hh-1/bills/f2/retry').reply(
      429,
      { message: 'Too many requests, retry in 12 seconds' },
      {
        'retry-after': '12',
      }
    );
    renderIt();
    await screen.findByText('The AI could not read it');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    const arg = at(toastMock.mock.calls, 0)[0] as {
      variant: string;
      title: string;
      description: string;
    };
    expect(arg.variant).toBe('destructive');
    expect(arg.title).toContain('Too many requests');
    expect(arg.description).toBe('Try again in 12 s');
    expect(screen.getByText('The AI could not read it')).toBeInTheDocument();
  });

  it('Retry 403 hands over to handleForbidden', async () => {
    two();
    mock
      .onPost('/households/hh-1/bills/f2/retry')
      .reply(403, { message: 'no' });
    renderIt();
    await screen.findByText('The AI could not read it');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(handleForbidden).toHaveBeenCalled());
  });

  it('Delete asks for confirmation then sends DELETE and refetches', async () => {
    two();
    mock.onDelete('/households/hh-1/bills/f1').reply(204);
    renderIt();
    await screen.findByText('This is not a receipt');
    const before = mock.history.get.length;
    await userEvent.click(
      at(screen.getAllByRole('button', { name: 'Delete' }), 0)
    );
    expect(await screen.findByText('Delete this receipt?')).toBeInTheDocument();
    expect(mock.history.delete).toHaveLength(0);
    const dialogBtns = screen.getAllByRole('button', { name: 'Delete' });
    await userEvent.click(at(dialogBtns, dialogBtns.length - 1));
    await waitFor(() => expect(mock.history.delete).toHaveLength(1));
    await waitFor(() =>
      expect(mock.history.get.length).toBeGreaterThan(before)
    );
  });

  it('Enter manually navigates to /bills/drafts/{id}', async () => {
    two();
    renderIt();
    await screen.findByText('This is not a receipt');
    await userEvent.click(
      at(screen.getAllByRole('button', { name: 'Enter manually' }), 0)
    );
    expect(screen.getByTestId('loc')).toHaveTextContent('/bills/drafts/f1');
  });

  it('the heading toggles the list', async () => {
    two();
    renderIt();
    const toggle = await screen.findByRole('button', {
      name: /couldn't read these receipts/i,
    });
    expect(screen.getByText('This is not a receipt')).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.queryByText('This is not a receipt')).toBeNull();
    await userEvent.click(toggle);
    expect(screen.getByText('This is not a receipt')).toBeInTheDocument();
  });
});

describe('FailedBillsGroup scroll', () => {
  it('scrolls into view once for #failed', async () => {
    const mock = new MockAdapter(apiClient);
    mock.onGet(/\/image$/).reply(200, new Blob(['x']));
    mock
      .onGet('/households/hh-1/bills/drafts')
      .reply(() => paged([failed('f1', 'not_a_receipt', 'nope')]));
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:x'),
      revokeObjectURL: vi.fn(),
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <HouseholdTestProvider value={makeHouseholdValue()}>
          <MemoryRouter initialEntries={['/bills/drafts#failed']}>
            <FailedBillsGroup />
          </MemoryRouter>
        </HouseholdTestProvider>
      </QueryClientProvider>
    );
    await screen.findByText('nope');
    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
    mock.restore();
  });
});
