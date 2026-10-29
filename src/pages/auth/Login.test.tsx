import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import '@/i18n';
import { ApiError } from '@/auth/apiError';
import type React from 'react';
import { Login } from './Login';

const loginMock = vi.fn();
let currentUser: unknown = null;
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ login: loginMock, user: currentUser }),
}));
const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]): unknown => toastMock(...args),
}));

const LOCKED = 'Too many failed login attempts, try again later';

function TransactionsPage(): React.ReactElement {
  const { search, hash } = useLocation();
  return (
    <>
      <div>transactions-page</div>
      <div data-testid="search-hash">{search + hash}</div>
    </>
  );
}

interface From {
  pathname: string;
  search?: string;
  hash?: string;
}

function renderLogin(from?: string | From): void {
  const fromState = typeof from === 'string' ? { pathname: from } : from;
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/login',
          state: fromState ? { from: fromState } : null,
        },
      ]}
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<div>dashboard-page</div>} />
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

type User = ReturnType<typeof userEvent.setup>;

async function fillAndSubmit(user: User): Promise<void> {
  await user.type(screen.getByLabelText('Email'), 'a@b.co');
  await user.type(screen.getByLabelText('Password'), 'secret-pass');
  await user.click(screen.getByRole('button', { name: 'Login' }));
}

describe('Login', () => {
  beforeEach(() => {
    loginMock.mockReset();
    toastMock.mockReset();
    currentUser = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('401 → inline invalid-credentials alert, password cleared, email kept', async () => {
    loginMock.mockRejectedValue(new ApiError(401, { message: 'Unauthorized' }));
    renderLogin();
    await fillAndSubmit(userEvent.setup());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email or password is incorrect'
    );
    expect(screen.getByLabelText('Email')).toHaveValue('a@b.co');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('lockout 429 with Retry-After 120 → submit disabled, shows 120', async () => {
    loginMock.mockRejectedValue(
      new ApiError(429, { message: LOCKED }, { 'retry-after': '120' })
    );
    renderLogin();
    await fillAndSubmit(userEvent.setup());
    expect(await screen.findByText(/Try again in 120 s/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled();
  });

  it('lockout 429 without header → 60 s fallback', async () => {
    loginMock.mockRejectedValue(new ApiError(429, { message: LOCKED }));
    renderLogin();
    await fillAndSubmit(userEvent.setup());
    expect(await screen.findByText(/Try again in 60 s/)).toBeInTheDocument();
  });

  it('submit re-enabled when countdown ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    loginMock.mockRejectedValue(
      new ApiError(429, { message: LOCKED }, { 'retry-after': '2' })
    );
    renderLogin();
    await fillAndSubmit(
      userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    );
    expect(await screen.findByText(/Try again in 2 s/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();
    expect(screen.queryByText(/Try again in/)).toBeNull();
  });

  it('throttler 429 → tooManyRequests toast, submit stays enabled', async () => {
    loginMock.mockRejectedValue(
      new ApiError(429, { message: 'ThrottlerException: Too Many Requests' })
    );
    renderLogin();
    await fillAndSubmit(userEvent.setup());
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Too many attempts, try again in a minute',
        })
      )
    );
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();
  });

  it('other errors → generic toast', async () => {
    loginMock.mockRejectedValue(new ApiError(500, { message: 'boom' }));
    renderLogin();
    await fillAndSubmit(userEvent.setup());
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Something went wrong, please try again',
        })
      )
    );
  });

  it('400 → field errors under the matching fields', async () => {
    loginMock.mockRejectedValue(
      new ApiError(400, { message: ['email must be an email'] })
    );
    renderLogin();
    await fillAndSubmit(userEvent.setup());
    expect(
      await screen.findByText('email must be an email')
    ).toBeInTheDocument();
  });

  // The real login sets the user; the signed-in redirect does the navigation.
  const signsIn = (): Promise<void> => {
    currentUser = { id: '1' };
    return Promise.resolve();
  };

  it('success → navigates to state.from', async () => {
    loginMock.mockImplementation(signsIn);
    renderLogin('/transactions');
    await fillAndSubmit(userEvent.setup());
    expect(await screen.findByText('transactions-page')).toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' })
    );
  });

  it('success → keeps the query string and hash of state.from', async () => {
    loginMock.mockImplementation(signsIn);
    renderLogin({
      pathname: '/transactions',
      search: '?month=5',
      hash: '#top',
    });
    await fillAndSubmit(userEvent.setup());
    expect(await screen.findByText('transactions-page')).toBeInTheDocument();
    expect(screen.getByTestId('search-hash')).toHaveTextContent('?month=5#top');
  });

  it('already signed in → redirect keeps the query string of state.from', async () => {
    currentUser = { id: '1' };
    renderLogin({ pathname: '/transactions', search: '?month=5' });
    expect(await screen.findByText('transactions-page')).toBeInTheDocument();
    expect(screen.getByTestId('search-hash')).toHaveTextContent('?month=5');
  });

  it('already signed in → redirects to state.from', async () => {
    currentUser = { id: '1' };
    renderLogin('/transactions');
    expect(await screen.findByText('transactions-page')).toBeInTheDocument();
  });

  it('already signed in without state → redirects to /dashboard', async () => {
    currentUser = { id: '1' };
    renderLogin();
    expect(await screen.findByText('dashboard-page')).toBeInTheDocument();
  });
});
