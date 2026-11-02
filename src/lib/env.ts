/**
 * Environment variables configuration
 * All environment variables must be prefixed with VITE_ to be accessible in the browser
 * Access them using: import.meta.env.VITE_*
 */

export const env = {
  apiUrl: (
    (import.meta.env.VITE_API_URL as string | undefined) ??
    'http://localhost:3000'
  ).replace(/\/$/, ''),
  apiTimeout: Number(
    (import.meta.env.VITE_API_TIMEOUT as string | undefined) ?? '30000'
  ),
  nodeEnv:
    (import.meta.env.VITE_NODE_ENV as string | undefined) ??
    (import.meta.env.MODE as string | undefined) ??
    'development',
  appName:
    (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'Accounting App',
  appVersion:
    (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '1.0.0',
} as const;

// Type-safe environment variable access
export type Env = typeof env;
