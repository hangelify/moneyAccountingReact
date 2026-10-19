import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrictMode, useEffect, type ReactElement } from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './AuthContext';
import { tokenStorage } from '@/auth/tokenStorage';
import { ApiError } from '@/auth/apiError';
import {
  AUTH_LOGOUT_EVENT,
  AUTH_TOKEN_EVENT,
  refreshAccessToken,
} from '@/auth/apiClient';
import type * as ApiClientModule from '@/auth/apiClient';
import { authApi } from '@/pages/auth/api';
import { toast } from '@/hooks/use-toast';
import type { UserProfileDto } from '@/types/auth';
import '@/i18n';

vi.mock('@/pages/auth/api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    revoke: vi.fn(),
    me: vi.fn(),
  },
}));

// Keep the real AUTH_* constants and signOut; only refresh is controlled.
vi.mock('@/auth/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, refreshAccessToken: vi.fn() };
});

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: vi.fn() }));

const refreshMock = vi.mocked(refreshAccessToken);
const api = vi.mocked(authApi);
const toastMock = vi.mocked(toast);

const profile: UserProfileDto = {
  id: '1',
  email: 'a@b.c',
  email_verified: true,
  first_name: 'A',
  currency: 'USD',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const tokens = {
  access_token: 'at',
  expires_in: 900,
  token_type: 'Bearer',
} as const;

type Auth = ReturnType<typeof useAuth>;
const authHolder: { current: Auth | null } = { current: null };

function getAuth(): Auth {
  if (!authHolder.current) throw new Error('AuthProvider not rendered');
  return authHolder.current;
}

function Capture(): null {
  const auth = useAuth();
  useEffect(() => {
    authHolder.current = auth;
  });
  return null;
}

function Probe(): ReactElement {
  const { user } = useAuth();
  if (user === undefined) return <div>loading</div>;
  if (user === null) return <div>logged-out</div>;
  return <div>hello {user.first_name}</div>;
}

function renderAuth(opts: { strict?: boolean } = {}): {
  queryClient: QueryClient;
} {
  const queryClient = new QueryClient();
  const tree = (
    <MemoryRouter initialEntries={['/dashboard']}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Capture />
          <Routes>
            <Route path="/login" element={<div>login-page</div>} />
            <Route path="*" element={<Probe />} />
          </Routes>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  render(opts.strict ? <StrictMode>{tree}</StrictMode> : tree);
  return { queryClient };
}

async function renderSignedIn(): Promise<{ queryClient: QueryClient }> {
  refreshMock.mockResolvedValue(undefined);
  api.me.mockResolvedValue(profile);
  const r = renderAuth();
  expect(await screen.findByText('hello A')).toBeInTheDocument();
  return r;
}

async function renderSignedOut(): Promise<{ queryClient: QueryClient }> {
  refreshMock.mockRejectedValue(new ApiError(401, undefined, {}, 'nope'));
  const r = renderAuth();
  expect(await screen.findByText('logged-out')).toBeInTheDocument();
  return r;
}

beforeEach(() => {
  vi.clearAllMocks();
  authHolder.current = null;
});

afterEach(() => {
  tokenStorage.clear({ broadcast: false });
});

describe('AuthProvider startup', () => {
  it('startup always refreshes then loads me', async () => {
    await renderSignedIn();
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(api.me).toHaveBeenCalledTimes(1);
    const [refreshOrder = Infinity] = refreshMock.mock.invocationCallOrder;
    const [meOrder = -Infinity] = api.me.mock.invocationCallOrder;
    expect(refreshOrder).toBeLessThan(meOrder);
  });

  it('startup refresh 401 → logged-out, no toast', async () => {
    await renderSignedOut();
    expect(api.me).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('StrictMode double mount → one refresh, signed in', async () => {
    // The real refreshAccessToken is single-flight: both mounts share one
    // in-flight promise (one network refresh).
    let resolveRefresh!: () => void;
    const shared = new Promise<void>((res) => {
      resolveRefresh = res;
    });
    refreshMock.mockReturnValue(shared);
    api.me.mockResolvedValue(profile);

    renderAuth({ strict: true });
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalledTimes(2);
    expect(refreshMock).toHaveNthReturnedWith(1, shared);
    expect(refreshMock).toHaveNthReturnedWith(2, shared);

    await act(async () => {
      resolveRefresh();
      await shared;
    });
    expect(await screen.findByText('hello A')).toBeInTheDocument();
  });
});

describe('AuthProvider login', () => {
  it('login stores token then loads me', async () => {
    await renderSignedOut();
    api.login.mockResolvedValue(tokens);
    let tokenSeenByMe: string | null = null;
    api.me.mockImplementation(() => {
      tokenSeenByMe = tokenStorage.getAccessToken();
      return Promise.resolve(profile);
    });

    await act(async () => {
      await getAuth().login({ email: 'a@b.c', password: 'pw' });
    });

    expect(api.login).toHaveBeenCalledWith({ email: 'a@b.c', password: 'pw' });
    expect(tokenSeenByMe).toBe('at');
    expect(tokenStorage.getAccessToken()).toBe('at');
    expect(screen.getByText('hello A')).toBeInTheDocument();
  });
});

describe('AuthProvider logout', () => {
  it('logout calls /auth/logout when a token exists, then lands on /login without toast', async () => {
    const { queryClient } = await renderSignedIn();
    tokenStorage.set(tokens, { broadcast: false });
    api.logout.mockResolvedValue(undefined);
    const clearSpy = vi.spyOn(queryClient, 'clear');

    await act(async () => {
      await getAuth().logout();
    });

    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(api.revoke).not.toHaveBeenCalled();
    expect(screen.getByText('login-page')).toBeInTheDocument();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(getAuth().user).toBeNull();
    expect(clearSpy).toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('logout falls back to revoke when logout rejects', async () => {
    await renderSignedIn();
    tokenStorage.set(tokens, { broadcast: false });
    api.logout.mockRejectedValue(new ApiError(500, undefined, {}, 'boom'));
    api.revoke.mockResolvedValue(undefined);

    await act(async () => {
      await getAuth().logout();
    });

    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(api.revoke).toHaveBeenCalledTimes(1);
    expect(screen.getByText('login-page')).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('logout with no access token calls revoke only', async () => {
    await renderSignedIn();
    api.revoke.mockResolvedValue(undefined);

    await act(async () => {
      await getAuth().logout();
    });

    expect(api.logout).not.toHaveBeenCalled();
    expect(api.revoke).toHaveBeenCalledTimes(1);
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('logout never throws, even when revoke rejects too', async () => {
    await renderSignedIn();
    tokenStorage.set(tokens, { broadcast: false });
    api.logout.mockRejectedValue(new Error('net'));
    api.revoke.mockRejectedValue(new Error('net'));

    await act(async () => {
      await expect(getAuth().logout()).resolves.toBeUndefined();
    });
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('two logout clicks do not throw', async () => {
    await renderSignedIn();
    tokenStorage.set(tokens, { broadcast: false });
    api.logout.mockResolvedValue(undefined);
    api.revoke.mockResolvedValue(undefined);

    await act(async () => {
      const { logout } = getAuth();
      await expect(Promise.all([logout(), logout()])).resolves.toEqual([
        undefined,
        undefined,
      ]);
    });
    expect(screen.getByText('login-page')).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalled();
  });
});

describe('AuthProvider session events', () => {
  it("auth:logout {reason:'expired'} while signed in → /login + sessionExpired toast + query cache cleared", async () => {
    const { queryClient } = await renderSignedIn();
    const clearSpy = vi.spyOn(queryClient, 'clear');

    act(() => {
      window.dispatchEvent(
        new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { reason: 'expired' } })
      );
    });

    expect(await screen.findByText('login-page')).toBeInTheDocument();
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Your session ended, please sign in again',
      })
    );
  });

  it("auth:logout {reason:'revoked'} → signedOutElsewhere toast", async () => {
    await renderSignedIn();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { reason: 'revoked' } })
      );
    });

    expect(await screen.findByText('login-page')).toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'You were signed out' })
    );
  });

  it('auth:logout while already signed out → no navigation, no toast', async () => {
    await renderSignedOut();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { reason: 'expired' } })
      );
    });

    expect(screen.getByText('logged-out')).toBeInTheDocument();
    expect(screen.queryByText('login-page')).not.toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('auth:token while signed out → loads me and signs in', async () => {
    await renderSignedOut();
    api.me.mockResolvedValue(profile);

    act(() => {
      window.dispatchEvent(new CustomEvent(AUTH_TOKEN_EVENT));
    });

    expect(await screen.findByText('hello A')).toBeInTheDocument();
    expect(api.me).toHaveBeenCalledTimes(1);
  });
});
