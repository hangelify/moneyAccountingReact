# Auth Flow — Investigation and Refactor Design

- **Date:** 2026-10-19
- **Branch:** `refactor/auth-flow` (from `dev`)
- **Source of truth:** _Auth Module — Frontend Implementation Guide_ (backend, Oct 19, 2026), referred to below as **the guide**
- **Scope:** Sign in, Sign up, refresh token, expired-session redirect, logout.
  Email verification, sessions page, change password and logout-all are listed under [Future work](#7-future-work).
- **Approach chosen:** A — rework the existing axios modules (`tokenStorage`, `apiClient`, `AuthContext`) in place. No `fetch` rewrite, no new state library.

---

## 1. Summary

The current FE was built for the **mobile/body-token** contract: the refresh token is returned in the JSON body, stored in `localStorage`, and sent back in the request body. The backend now treats a browser as a **web client**: the refresh token lives only in an `HttpOnly; Secure; SameSite=Strict; Path=/auth` cookie, the body never contains it, and unknown body fields are rejected with 400.

As a result, against the current backend:

1. **Session does not survive a reload.** Bootstrap is gated on a `localStorage` refresh token that web mode never provides, so every reload signs the user out.
2. **Refresh cannot succeed.** No request sends `withCredentials`, so the cookie is never stored or sent; the refresh call sends a body token the server ignores, to a URL that is built incorrectly.
3. **Refresh token is exposed to XSS** whenever it does get stored (`localStorage`), violating the guide's storage rules.
4. **Multi-tab use can kill the session** (no cross-tab single-flight; the server revokes the session on refresh token reuse).
5. **An expired session does not redirect with feedback**; the user is only bounced by `RequireAuth` on the next protected render.
6. **Forms diverge from server rules** (register is stricter than the server; sign in has no lockout handling; raw server text is toasted).
7. **Logout never clears the cookie** (no credentials) and has no `revoke` fallback, so the server session can outlive a "logged out" browser.

## 2. Files involved

| File | Role today |
|---|---|
| `src/auth/tokenStorage.ts` | Access token in memory, refresh token in `localStorage` |
| `src/auth/apiClient.ts` | axios instance, Bearer interceptor, 401 → refresh → replay |
| `src/auth/apiError.ts` | Error class (`status`, `code`, `message`, `body`) |
| `src/auth/RequireAuth.tsx` | Route guard (`undefined` → render nothing, `null` → `/login`) |
| `src/contexts/AuthContext.tsx` | Bootstrap, login/register/logout, logout event + `storage` listener |
| `src/pages/auth/api.ts` | `authApi` (login, register, refresh, logout, me) |
| `src/pages/auth/Login.tsx`, `Register.tsx` | Forms |
| `src/lib/validation-schemas.ts`, `src/lib/validation.ts` | zod schemas + duplicate imperative validators |
| `src/types/auth.ts`, `src/const/auth.ts` | DTOs, endpoints, storage key |
| `src/lib/env.ts`, `.env.example` | `VITE_API_URL` |
| `src/components/bills/NewBillModal.tsx` | Has its own 401 "Session expired" toast |

---

## 3. Investigation

### 3.1 Sign in — `POST /auth/login`

**Current flow:** `Login.tsx` → `AuthContext.login` → `authApi.login` (axios, no credentials) → `tokenStorage.setTokenResponse` (access token in memory, `refresh_token` to `localStorage`) → `authApi.me()` → `setUser` → navigate to `state.from` or `/dashboard`.

| # | Finding | Where | Guide says |
|---|---|---|---|
| L1 | Request sent without `withCredentials`, so the `Set-Cookie: refresh_token` from the response is **dropped** by the browser (cross-origin `localhost:5173` → `localhost:3000`) | `src/auth/apiClient.ts:7-10` | `credentials: 'include'` on every `/auth/*` call |
| L2 | `setTokenResponse` writes `res.refresh_token` to `localStorage`. In web mode the field is absent → `localStorage.setItem(key, undefined)` stores the string `"undefined"` | `src/auth/tokenStorage.ts:26-29` | Refresh token is never visible to JS; never store auth data in web storage |
| L3 | `TokenResponseDto.refresh_token` typed as required | `src/types/auth.ts:25-30` | `refresh_token` is mobile-only |
| L4 | Access token + expiry kept in memory ✅, but `expiresAt` is never used (no proactive refresh) | `src/auth/tokenStorage.ts:5-14` | Refresh ~60 s before `expiresAt` |
| L5 | Login form: password only `min(1)` ✅ (does not enforce 8) | `src/lib/validation-schemas.ts:30` | Do not enforce 8 on sign in |
| L6 | Any error is toasted with raw `error.message` (e.g. `Invalid credentials`, `ThrottlerException: Too Many Requests`, or a joined validation array) | `src/pages/auth/Login.tsx:46-52` | 401 → "Email or password is incorrect" (no hint); map messages to i18n keys |
| L7 | No handling of the lockout `429` + `Retry-After` (no countdown, submit stays enabled) | `src/pages/auth/Login.tsx` | Disable form, countdown from `Retry-After`, fallback 60 s |
| L8 | Password field not cleared on 401 | `src/pages/auth/Login.tsx` | Keep email, clear password |
| L9 | `ApiError` reads `message` as a string only and does not expose response headers, so `Retry-After` and validation arrays cannot be handled | `src/auth/apiError.ts`, `src/auth/apiClient.ts:67-74` | `message` is `string \| string[]`; read `Retry-After` |
| L10 | API base URL default `http://localhost:3000/api`; local `.env` has `http://localhost:3000/` (trailing slash) | `src/lib/env.ts:8-10`, `.env.example:2` | No global prefix: `http://localhost:3000/auth/login` |

Note on L9/L7: the backend CORS config (`accounting_node/accounting/src/app.setup.ts`) has no `exposedHeaders`, so `Retry-After` is invisible to cross-origin JS today. The FE must fall back to 60 s; ask BE to add `exposedHeaders: ['Retry-After']`.

### 3.2 Sign up — `POST /auth/register`

**Current flow:** identical to sign in, through `AuthContext.register`. Optional fields are omitted when empty ✅, `first_name` trimmed ✅.

| # | Finding | Where | Guide says |
|---|---|---|---|
| R1 | Same as L1–L3 (no credentials, refresh token to `localStorage`) | — | — |
| R2 | Password requires uppercase + lowercase + symbol. The server does not; users with valid passphrases (e.g. `correct-horse-battery`, the guide's own example) are blocked | `src/lib/validation-schemas.ts:19-28` | Min 8 chars, max 72 **bytes** UTF-8 |
| R3 | No 72-byte maximum check (multibyte RU/RO passwords can pass the client and fail on the server) | same | Max 72 bytes UTF-8 |
| R4 | `first_name` requires ≥ 2 chars; server accepts 1. No max length (255) on any name field | `src/lib/validation-schemas.ts:35-38, 55-56` | Non-empty, max 255 |
| R5 | `src/lib/validation.ts` duplicates the same (wrong) rules imperatively | `src/lib/validation.ts` | — (dead/duplicate code) |
| R6 | `400 User already exists` toasted as raw text; no link to sign in | `src/pages/auth/Register.tsx:61-67` | Error on the email field + link to sign in |
| R7 | Validation arrays not mapped to fields | same | Map by leading property name |
| R8 | Success toast only; no "check your inbox" notice (`email_verified` not in `UserProfileDto`) | `Register.tsx:55-59`, `src/types/auth.ts:32-42` | Banner while `email_verified` is false |
| R9 | `passwordHint` i18n text describes the wrong rules | `src/i18n/locales/en/auth.json` | — |

### 3.3 Refresh token — `POST /auth/refresh`

**Current flow:** the response interceptor catches a 401 on any non-auth request, calls `refreshAccessToken()` (single-flight per tab via a shared promise ✅), which reads the refresh token from `localStorage` and does `axios.post(`${env.apiUrl}/auth/refresh`, { refresh_token })` with the bare axios instance. On success it replays the request once (`_retried` flag ✅); on failure it clears storage and dispatches `auth:logout`.

| # | Finding | Where | Guide says |
|---|---|---|---|
| T1 | Refresh reads the token from `localStorage`; in web mode it is never there → throws `NO_REFRESH_TOKEN` → user is signed out on the first expired access token (≤ 15 min after sign in) | `src/auth/apiClient.ts:22-24` | Server reads only the cookie |
| T2 | Sends `{ refresh_token }` in the body, without credentials. The server ignores the body token in web mode and gets no cookie → `401 Missing refresh token cookie` | `src/auth/apiClient.ts:25-29` | No body, `credentials: 'include'` |
| T3 | URL built by string concatenation: with `.env` `VITE_API_URL=http://localhost:3000/` it becomes `http://localhost:3000//auth/refresh` | `src/auth/apiClient.ts:26` | — |
| T4 | Uses bare `axios`, bypassing the instance config (base URL, credentials, error mapping) | same | — |
| T5 | No cross-tab single-flight. Two tabs refreshing together → the second sends an already-rotated cookie → **server revokes the session for all tabs** (`Refresh token reuse detected`) | — | Web Locks `auth-refresh` + BroadcastChannel |
| T6 | No token sharing across tabs. The old `storage`-event sync only reacts to `localStorage` removal, which disappears with the cookie model | `src/contexts/AuthContext.tsx:61-75` | BroadcastChannel `token` / `logout` |
| T7 | No proactive refresh; every expiry costs one failed request + replay | — | Refresh at `expiresAt − 60 s` |
| T8 | **Bootstrap skips refresh** when `localStorage` has no token and sets `user = null`. With the cookie model this is always true → **every page reload signs the user out** | `src/contexts/AuthContext.tsx:40-59` | On app start always `POST /auth/refresh`, then `GET /auth/me` |
| T9 | When bootstrap does run, it calls `me()` first and relies on a 401 → refresh. Works, but costs a guaranteed failed request | same | Refresh first, then `/me` |
| T10 | `authApi.refresh(p)` takes a body token and is unused | `src/pages/auth/api.ts:21-24` | — |
| T11 | A 401 on the **replayed** request is not treated as sign-out (rejected as a plain error) | `src/auth/apiClient.ts:55-65` | Second 401 on replay → sign out |

### 3.4 Expired session → redirect to sign in

**Current flow:** refresh failure → `tokenStorage.clear()` + `window` event `auth:logout` → `AuthProvider` sets `user = null` → **only if the current route is wrapped in `RequireAuth`** does a re-render redirect to `/login` with `state.from`.

| # | Finding | Where | Guide says |
|---|---|---|---|
| E1 | No user feedback on the global path. The only "Session expired" message is local to the bill photo modal | `src/components/bills/NewBillModal.tsx:69-73` | "Your session ended" / "You were signed out" / "Session expired, sign in again", picked by message |
| E2 | Redirect depends on `RequireAuth` re-rendering; a signed-in user on a public page (`/`) is silently shown signed-out UI | `src/auth/RequireAuth.tsx` | Clear state, go to sign in |
| E3 | React Query cache is not cleared on sign-out (previous user's data can remain in memory) | `src/main.tsx`, `AuthContext.tsx` | Clear user store, cancel queries |
| E4 | Other tabs are not told about the sign-out | — | Broadcast logout |
| E5 | `RequireAuth` renders `null` while `user === undefined` (blank screen during bootstrap) | `src/auth/RequireAuth.tsx:13` | Splash/loading state, do not redirect yet |
| E6 | Bootstrap 401 must **not** show an error (correct today by accident: it shows nothing) | `AuthContext.tsx:51-55` | No toast on bootstrap 401 |

### 3.5 Logout — `POST /auth/logout` / `POST /auth/revoke`

| # | Finding | Where | Guide says |
|---|---|---|---|
| O1 | Sends `{ refresh_token }` (read from `localStorage`, possibly `"undefined"` from L2) in the body. The controller has no `@Body`, so it is ignored, but it keeps the refresh token flowing through JS | `src/contexts/AuthContext.tsx:94-104`, `src/types/auth.ts:21-23` | Body is ignored; send none |
| O2 | No credentials → the `Set-Cookie` that clears the cookie is dropped; the browser keeps the refresh cookie | `src/auth/apiClient.ts` | `credentials: 'include'` |
| O3 | No fallback to `POST /auth/revoke` when the access token is expired/missing → session stays alive server-side | — | Fall back to revoke (always 200) |
| O4 | Local state is always cleared ✅, but other tabs are not told and the refresh timer (once added) must be cancelled | — | Broadcast logout, cancel timer |
| O5 | Logout 401 goes through the refresh interceptor (`/auth/logout` is not in `AUTH_PATHS`), so a dead session triggers a pointless refresh first | `src/auth/apiClient.ts:43` | — |

---

## 4. Target design

### 4.1 Token core — `src/auth/tokenStorage.ts`

- Memory only: `accessToken`, `expiresAt`, `tokenVersion`, `refreshTimer`.
- Remove all `localStorage` access, `STORAGE_KEYS`, `REFRESH_KEY`.
- API:
  - `getAccessToken()`, `getExpiresAt()`, `getVersion()`
  - `set(res: TokenResponseDto, { broadcast = true })` — store token, `expiresAt = now + expires_in * 1000`, `tokenVersion++`, schedule refresh at `max(expires_in − 60, 5)` seconds, optionally broadcast `{ type: 'token', res }`.
  - `clear({ broadcast = true })` — clear memory, cancel timer, `tokenVersion++`, optionally broadcast `{ type: 'logout' }`.
- The scheduled callback calls `refreshAccessToken()`; on failure → `onSignedOut('expired')`. To avoid an import cycle, `tokenStorage` takes the callback via `tokenStorage.onRefreshDue(fn)`, registered by `apiClient`.
- `TokenResponseDto`: remove `refresh_token`.

### 4.2 Cross-tab channel — `src/auth/authChannel.ts` (new)

- Wraps `BroadcastChannel('auth')` with a no-op fallback when unavailable (jsdom, old browsers).
- Messages: `{ type: 'token'; res: TokenResponseDto }`, `{ type: 'logout'; reason: SignOutReason }`.
- Incoming `token` → `tokenStorage.set(res, { broadcast: false })`.
- Incoming `logout` → `tokenStorage.clear({ broadcast: false })` + dispatch the sign-out event locally.

### 4.3 HTTP client — `src/auth/apiClient.ts`

- `baseURL: env.apiUrl` (trailing slash trimmed in `env.ts`), `withCredentials: true` on the instance. The cookie is `Path=/auth`, so it is not sent elsewhere.
- Never send `X-Client-Type`.
- Request interceptor: unchanged (Bearer from memory).
- `refreshAccessToken()`:
  - In-tab single-flight: shared promise (kept).
  - Cross-tab: inside `navigator.locks.request('auth-refresh', …)`; if `navigator.locks` is missing, run directly.
  - After acquiring the lock: if `tokenVersion` changed since the call started and a token exists, another tab already refreshed → return without calling the server.
  - Call `apiClient.post('/auth/refresh')` with **no body**, marked to skip the 401 interceptor.
  - Success → `tokenStorage.set(res)` (broadcasts). Failure → `tokenStorage.clear()` (broadcasts) and rethrow.
- Response interceptor:
  - Skip the refresh logic for `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/revoke`, `/auth/logout`.
  - 401 on a protected request not yet retried → refresh → replay once.
  - Refresh fails, or the replay returns 401 → `signOut(reason)` where `reason` comes from the 401 message: `Session not found or revoked` → `'revoked'`, anything else → `'expired'`.
  - Always reject with an `ApiError`.
- `signOut(reason)` (exported): `tokenStorage.clear()` + dispatch `AUTH_LOGOUT_EVENT` with `detail: { reason }`.
- `SignOutReason = 'expired' | 'revoked' | 'user'`.

### 4.4 Errors — `src/auth/apiError.ts`

- Fields: `status`, `messages: string[]` (normalised from `string | string[]`), `message` (first/joined), `headers`, `body`.
- Helpers:
  - `fieldErrors(): Record<string, string>` — maps validation messages to fields by their first word (`email …`, `password …`, `first_name …`).
  - `retryAfterSeconds(): number | null` — reads `Retry-After`.
- Drop the unused `code` field once callers are updated.

### 4.5 Auth API — `src/pages/auth/api.ts`

- `login`, `register` → `TokenResponseDto`.
- `refresh()` → no body.
- `logout()` → no body; `revoke()` → no body; `me()`.
- Remove `RefreshTokenRequest`, `LogoutRequest`.

### 4.6 Bootstrap — `src/contexts/AuthContext.tsx`

1. `user` starts `undefined`.
2. On mount: `await refreshAccessToken()` → `await authApi.me()` → `setUser(profile)`.
3. Any failure → `setUser(null)`, no toast.
4. React StrictMode runs the effect twice in dev; in-tab single-flight makes both share one request.
5. `RequireAuth` shows a splash (`LoadingFallback`) while `user === undefined` instead of `null`.

### 4.7 Sign in

- Schema: `email` valid; `password` non-empty (do **not** enforce 8).
- Success: `tokenStorage.set(res)` → `me()` → `setUser` → navigate to `state.from.pathname` or `/dashboard`.
- Errors:
  - `401` → form-level error `auth:errors.invalidCredentials`; keep email, clear password.
  - `429` with message `Too many failed login attempts, try again later` → disable submit, show a countdown of `retryAfterSeconds() ?? 60`.
  - `429` throttler → `auth:errors.tooManyRequests`.
  - `400` array → `form.setError` per field via `fieldErrors()`.
  - Other → generic `auth:errors.generic`.

### 4.8 Sign up

- Schema (single source; delete `src/lib/validation.ts`):
  - `email`: valid email.
  - `password`: `min(8)` and `new TextEncoder().encode(v).length <= 72`.
  - `first_name`: trimmed, `min(1)`, `max(255)`.
  - `last_name`, `username`: optional, `max(255)`; omitted from the payload when empty (kept).
- Update the `passwordHint` text: "At least 8 characters".
- Errors:
  - `400 User already exists` → `form.setError('email', …)` with a link to `/login`.
  - `400` array → field errors.
  - `429` → `auth:errors.tooManyRequests`.
- Success: same as sign in, plus a "Check your inbox to confirm your email" toast. Add `email_verified: boolean` to `UserProfileDto` (the full banner is future work).

### 4.9 Expired session → sign in

- `AuthProvider` listens to `AUTH_LOGOUT_EVENT`:
  - `setUser(null)`, `queryClient.clear()`.
  - `navigate('/login', { replace: true, state: { from: location, reason } })`.
  - Toast by reason: `expired` → `errors:sessionExpired` ("Your session ended, please sign in again"), `revoked` → `errors:signedOutElsewhere` ("You were signed out"), `user` → none.
- Applies on public pages too, but only if a user was signed in (`user != null` before the event); the bootstrap failure path never fires it.
- `NewBillModal` drops its own 401 toast and just closes; the global handler owns the message.
- Remove the `storage` event listener.

### 4.10 Logout

```
logout():
  try   accessToken ? POST /auth/logout : POST /auth/revoke
  catch POST /auth/revoke (ignore errors)
  finally signOut('user')
```

No request body. `signOut` clears memory, cancels the timer, broadcasts to other tabs and routes to `/login` without a toast.

### 4.11 Config

- `env.apiUrl` default → `http://localhost:3000`; strip a trailing slash.
- `.env.example` → `VITE_API_URL=http://localhost:3000`.
- The dev server must run on exactly `FRONTEND_URL` (`http://localhost:5173`), otherwise the backend answers `403 Request origin is not allowed`.

### 4.12 i18n keys (EN; RU/RO when those locales exist)

`auth:errors.invalidCredentials`, `auth:errors.accountLocked` (with `{{seconds}}`), `auth:errors.tooManyRequests`, `auth:errors.userExists`, `auth:errors.generic`, `auth:register.checkInbox`, `errors:sessionExpired` (reworded), `errors:signedOutElsewhere`. Server text is never shown raw.

---

## 5. Data flow

```
App start ──► POST /auth/refresh (cookie) ──200──► memory token ──► GET /auth/me ──► signed in
                        │
                        └──401──► signed out (no toast)

Protected call ──401──► [tab promise] ──► [Web Lock auth-refresh] ──► version changed? ──yes──► reuse token
                                                                   └─no──► POST /auth/refresh
                         ◄── replay once ◄── 200 (broadcast token)
                         └── 401 / replay 401 ──► signOut(reason) ──► broadcast logout ──► /login + toast

Timer (expiresAt − 60 s) ──► refreshAccessToken() (same path)
```

## 6. Testing

Existing tests to update: `src/auth/apiClient.test.ts`, `src/auth/tokenStorage.test.ts`, `src/auth/RequireAuth.test.tsx`, `src/contexts/AuthContext.test.tsx`.

New or changed cases:

- `tokenStorage` never touches `localStorage`; `set` schedules the timer at `expires_in − 60` (fake timers); `clear` cancels it.
- Refresh sends no body and uses `withCredentials`.
- 5 concurrent 401s → exactly one `POST /auth/refresh`, all 5 replayed.
- Replay returning 401 → `signOut`.
- Web Locks: stubbed `navigator.locks` is used; missing `navigator.locks` falls back to a direct call; a version change while waiting skips the network call.
- BroadcastChannel: incoming `token` updates memory without re-broadcast; incoming `logout` triggers sign-out.
- Bootstrap: always calls refresh, then `/me`; refresh 401 → `user = null`, no toast.
- Sign-out event → navigates to `/login` with `reason`, clears the query cache, shows the right toast.
- Logout: no body; falls back to `/auth/revoke` on error or missing token; always clears state.
- Register schema: accepts `correct-horse-battery`; rejects 7 chars; rejects > 72 bytes with multibyte input; accepts a 1-char first name.
- Login: 401 clears password and shows the generic message; lockout 429 disables submit and counts down (60 s fallback when the header is hidden).

Manual check against the running backend: sign in, reload (stays signed in), two tabs open past one access-token lifetime (session survives), logout in one tab (the other tab lands on `/login`).

## 7. Future work (out of scope)

- `/verify-email?token=` route, resend with 60 s cooldown, persistent banner while `email_verified` is false.
- Sessions page (`GET/DELETE /auth/sessions`), "sign out everywhere" (`logout-all`).
- Change password.
- Backend: add `exposedHeaders: ['Retry-After']` to CORS.
- Moving auth state to zustand / `/me` to react-query (approach C).
