import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import '@/i18n';
import type * as ApiClientModule from '@/auth/apiClient';
import App from './App';

// Startup refresh: no session cookie in tests, so start signed out without
// touching the network.
vi.mock('@/auth/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return {
    ...actual,
    refreshAccessToken: vi.fn(() => Promise.reject(new Error('no session'))),
  };
});

// Create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

describe('App', () => {
  it('renders without crashing', async () => {
    const queryClient = createTestQueryClient();
    render(
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    );

    // Wait for lazy-loaded components
    await waitFor(() => {
      expect(screen.getByText(/Money Accounting App/i)).toBeInTheDocument();
    });
  });

  it('renders Header component', async () => {
    const queryClient = createTestQueryClient();
    render(
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      // Check for Header brand link
      const headerLink = screen.getByRole('link', { name: /AccountingApp/i });
      expect(headerLink).toBeInTheDocument();
      expect(headerLink).toHaveAttribute('href', '/');
    });
  });

  it('renders navigation links in Header', async () => {
    const queryClient = createTestQueryClient();
    render(
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      // There are multiple Login/Register links (Header and Home page), so use getAllByRole
      const loginLinks = screen.getAllByRole('link', { name: /login/i });
      const registerLinks = screen.getAllByRole('link', { name: /register/i });

      expect(loginLinks.length).toBeGreaterThan(0);
      expect(registerLinks.length).toBeGreaterThan(0);

      // Verify at least one link points to the correct route
      expect(
        loginLinks.some((link) => link.getAttribute('href') === '/login')
      ).toBe(true);
      expect(
        registerLinks.some((link) => link.getAttribute('href') === '/register')
      ).toBe(true);
    });
  });

  it('offers guests a theme switch in the header', async () => {
    const queryClient = createTestQueryClient();
    render(
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    );

    expect(
      await screen.findByRole('button', { name: 'Change theme' })
    ).toBeInTheDocument();
  });

  it('renders Home page content', async () => {
    const queryClient = createTestQueryClient();
    render(
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /A simple way to capture and organize your receipts\./i
        )
      ).toBeInTheDocument();
    });
  });
});

describe('App /dev/ui', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('serves the UI showcase in dev builds', async () => {
    window.history.pushState({}, '', '/dev/ui');
    render(
      <ThemeProvider>
        <QueryClientProvider client={createTestQueryClient()}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    );

    expect(
      await screen.findByRole('heading', { name: 'UI showcase' })
    ).toBeInTheDocument();
  });
});

describe('App routes', () => {
  it('redirects /households/settings to /households', async () => {
    window.history.pushState({}, '', '/households/settings');
    render(
      <ThemeProvider>
        <QueryClientProvider client={createTestQueryClient()}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    );

    // Signed out: RequireAuth sends us to login remembering where we were
    // headed, and the legacy path must already be redirected by then.
    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
    expect(
      (window.history.state as { usr?: { from?: { pathname?: string } } }).usr
        ?.from?.pathname
    ).toBe('/households');
    window.history.pushState({}, '', '/');
  });
});
