import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type ReactElement,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { tokenStorage } from '@/auth/tokenStorage';
import {
  AUTH_LOGOUT_EVENT,
  AUTH_TOKEN_EVENT,
  refreshAccessToken,
  signOut,
} from '@/auth/apiClient';
import type { SignOutReason } from '@/auth/authChannel';
import { authApi } from '@/pages/auth/api';
import { toast } from '@/hooks/use-toast';
import type {
  UserProfileDto,
  LoginRequest,
  RegisterRequest,
} from '@/types/auth';

interface AuthContextValue {
  user: UserProfileDto | null | undefined;
  isAuthenticated: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

type LogoutEventDetail = { reason?: SignOutReason } | null | undefined;

const TOAST_KEY_BY_REASON: Record<
  SignOutReason,
  'sessionExpired' | 'signedOutElsewhere' | null
> = {
  expired: 'sessionExpired',
  revoked: 'signedOutElsewhere',
  user: null,
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [user, setUserState] = useState<UserProfileDto | null | undefined>(
    undefined
  );
  // Event listeners and async continuations read the latest values here.
  const userRef = useRef<UserProfileDto | null | undefined>(undefined);
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  const queryClient = useQueryClient();
  const { t } = useTranslation('errors');

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const setUser = useCallback((next: UserProfileDto | null): void => {
    userRef.current = next;
    setUserState(next);
  }, []);

  /**
   * Local side of a sign-out: drop the user and cached data, and send a
   * previously signed-in user to /login. Idempotent once the user is null.
   */
  const handleSignedOut = useCallback(
    (reason: SignOutReason): void => {
      const wasSignedIn = userRef.current != null;
      setUser(null);
      queryClient.clear();
      if (!wasSignedIn) return;
      void navigate('/login', {
        replace: true,
        state: { from: locationRef.current, reason },
      });
      const key = TOAST_KEY_BY_REASON[reason];
      if (key) toast({ variant: 'destructive', title: t(key) });
    },
    [navigate, queryClient, setUser, t]
  );

  // Startup: the refresh cookie is HttpOnly, so always try it. In StrictMode
  // both mounts share refreshAccessToken's in-flight promise; whichever
  // resolves first sets the user, unless a sign-in/out already decided it.
  useEffect(() => {
    refreshAccessToken()
      .then(() => authApi.me())
      .then((profile) => {
        if (userRef.current === undefined) setUser(profile);
      })
      .catch(() => {
        if (userRef.current === undefined) setUser(null);
      });
  }, [setUser]);

  useEffect(() => {
    const onLogout = (e: Event): void => {
      const detail = (e as CustomEvent<LogoutEventDetail>).detail;
      handleSignedOut(detail?.reason ?? 'expired');
    };
    // Another tab signed in or refreshed and its token is now ours: adopt its
    // session if we have none, and switch user if it belongs to someone else
    // (never show one account's data while requests run as another). A failed
    // me() leaves state alone; the interceptor handles 401s.
    const onToken = (): void => {
      if (userRef.current === undefined) return; // startup decides
      authApi
        .me()
        .then((profile) => {
          const current = userRef.current;
          if (current === null) {
            setUser(profile);
            return;
          }
          if (current === undefined || current.id === profile.id) return;
          queryClient.clear();
          setUser(profile);
          void navigate('/dashboard', { replace: true });
        })
        .catch(() => undefined);
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
    window.addEventListener(AUTH_TOKEN_EVENT, onToken);
    return () => {
      window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
      window.removeEventListener(AUTH_TOKEN_EVENT, onToken);
    };
  }, [handleSignedOut, navigate, queryClient, setUser]);

  const login = useCallback(
    async (payload: LoginRequest): Promise<void> => {
      const res = await authApi.login(payload);
      tokenStorage.set(res);
      const profile = await authApi.me();
      setUser(profile);
    },
    [setUser]
  );

  const register = useCallback(
    async (payload: RegisterRequest): Promise<void> => {
      const res = await authApi.register(payload);
      tokenStorage.set(res);
      const profile = await authApi.me();
      setUser(profile);
    },
    [setUser]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      if (tokenStorage.getAccessToken()) {
        try {
          await authApi.logout();
        } catch {
          // The access token may be stale; end the session by cookie instead.
          await authApi.revoke().catch(() => undefined);
        }
      } else {
        await authApi.revoke().catch(() => undefined);
      }
    } finally {
      // signOut is a no-op when already signed out at this token version, so
      // the local cleanup and redirect must not depend on its event.
      signOut('user');
      handleSignedOut('user');
    }
  }, [handleSignedOut]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user != null,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
