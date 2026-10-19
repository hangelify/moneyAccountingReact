import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@/i18n';
import { ApiError } from '@/auth/apiError';
import { Register } from './Register';

const registerMock = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ register: registerMock }),
}));
const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]): unknown => toastMock(...args),
}));

function renderRegister(): void {
  render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<div>dashboard-page</div>} />
        <Route path="/login" element={<div>login-page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function fillAndSubmit(): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'a@b.co');
  await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
  await user.type(screen.getByLabelText(/First Name/), 'Ann');
  await user.click(screen.getByRole('button', { name: 'Register' }));
}

describe('Register', () => {
  beforeEach(() => {
    registerMock.mockReset();
    toastMock.mockReset();
  });

  it('400 User already exists → email field error with a link to /login', async () => {
    registerMock.mockRejectedValue(
      new ApiError(400, { message: 'User already exists' })
    );
    renderRegister();
    await fillAndSubmit();
    expect(
      await screen.findByText('An account with this email already exists')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Sign in instead' })
    ).toHaveAttribute('href', '/login');
  });

  it('400 validation array → errors under the matching fields', async () => {
    registerMock.mockRejectedValue(
      new ApiError(400, { message: ['first_name should not be empty'] })
    );
    renderRegister();
    await fillAndSubmit();
    expect(
      await screen.findByText('first_name should not be empty')
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in instead' })).toBeNull();
  });

  it('429 → tooManyRequests toast', async () => {
    registerMock.mockRejectedValue(
      new ApiError(429, { message: 'ThrottlerException: Too Many Requests' })
    );
    renderRegister();
    await fillAndSubmit();
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Too many attempts, try again in a minute',
        })
      )
    );
  });

  it('success → checkInbox toast and navigate to /dashboard', async () => {
    registerMock.mockResolvedValue(undefined);
    renderRegister();
    await fillAndSubmit();
    expect(await screen.findByText('dashboard-page')).toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Check your inbox to confirm your email',
      })
    );
  });

  it('omits empty optional fields from the payload', async () => {
    registerMock.mockResolvedValue(undefined);
    renderRegister();
    await fillAndSubmit();
    await screen.findByText('dashboard-page');
    expect(registerMock).toHaveBeenCalledTimes(1);
    const payload = registerMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual({
      email: 'a@b.co',
      password: 'correct-horse-battery',
      first_name: 'Ann',
    });
    expect('last_name' in payload).toBe(false);
  });
});
