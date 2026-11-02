# Auth Flow Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the React app to the backend's web auth contract: HttpOnly refresh cookie, in-memory access token, cross-tab single-flight refresh, a redirect to sign-in with a reason when the session ends, and forms that match the server rules.

**Architecture:** Approach A from the spec. Keep the existing `tokenStorage` / `apiClient` / `AuthContext` split. Add one small transport module (`authChannel`) for tab sync. `apiClient` owns refresh and sign-out. `AuthProvider` owns user state, navigation and toasts. The forms get a shared `ApiError` with field mapping.

**Tech Stack:** React 19, react-router-dom 7, axios 1.x (+ axios-mock-adapter), TanStack Query 5, react-hook-form + zod 4, i18next, Vitest 4 + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-19-auth-flow-design.md` (finding IDs such as L1, T5, E3 refer to it)

## Global Constraints

- Nothing auth-related in `localStorage` or `sessionStorage`. Remove the key `accounting_app_refresh_token` everywhere.
- Every `/auth/*` request goes through the `apiClient` instance with `withCredentials: true`. Never send an `X-Client-Type` header. Never send `refresh_token` in a body.
- API base URL default is `http://localhost:3000`, with no `/api` and no trailing slash. Paths start with `/auth/...`.
- Proactive refresh delay: `Math.max(expires_in - 60, 5)` seconds.
- Web Lock name `auth-refresh`. BroadcastChannel name `auth`.
- `SignOutReason = 'expired' | 'revoked' | 'user'`.
- Sign-up password: at least 8 characters and `new TextEncoder().encode(pw).length <= 72`. Sign-in password: non-empty only (do not enforce 8 or 6).
- Name fields: max 255. `first_name`: trimmed, min 1.
- Lockout fallback is 60 s when `Retry-After` is unreadable.
- Never show raw server text. Every user-facing message comes from i18n keys (EN only; no RU/RO locale files exist yet).
- Match existing style: named exports, explicit return types, `@/` imports, colocated `*.test.ts(x)`.
- The pre-commit hook (lint-staged) runs `eslint --fix`, `prettier --write` and `tsc --noEmit`, so every commit must type-check. Tasks 3 and 4 break callers that Task 5 fixes, so they **do not commit**; Task 5 commits Tasks 3–5 together. Do not use `--no-verify`. Review Tasks 3 and 4 from the working-tree diff (`git diff`).

## Review Focus

1. **The proactive timer and a reactive 401 fire together.** Expect exactly one `POST /auth/refresh` (Task 4).
2. **React StrictMode double-mounts `AuthProvider` in dev.** Expect one refresh on startup, and the user ends up signed in (Task 5).
3. **The user signs in in tab A while tab B shows signed out.** Tab B should become signed in after the token broadcast, without a reload (Tasks 4 and 5).
4. **Logout is clicked after the access token has already expired, or clicked twice.** Expect `/auth/revoke` to be used, no unhandled rejection, and the user ending on `/login` (Task 5).
5. **The lockout countdown reaches 0, or the user leaves the page mid-countdown.** Submit is re-enabled at 0, and the interval is cleared on unmount (Task 8).

---

### Task 1: `ApiError` normalisation

**Files:**
- Modify: `src/auth/apiError.ts`
- Modify: `src/auth/apiClient.ts:67-74` (constructor call site only)
- Test: `src/auth/apiError.test.ts` (new); update the `code` expectation in `src/auth/apiClient.test.ts`

**Interfaces:**
- Produces:
  - `class ApiError extends Error { readonly status: number | undefined; readonly messages: string[]; readonly headers: Record<string, string>; readonly body: unknown; constructor(status: number | undefined, body: unknown, headers?: Record<string, string>, fallbackMessage?: string) }`
  - `message`: `messages[0]`, or `fallbackMessage`, or `'Request failed'`.
  - `fieldErrors(): Record<string, string>`: for each message, the key is the text up to the first space, and the value is the full message. Only messages whose first word matches `/^[a-z_]+$/` count.
  - `retryAfterSeconds(): number | null`: the positive integer parsed from `headers['retry-after']`, else `null`.
  - The `code` field is removed.

- [ ] **Step 1: Write failing tests in `src/auth/apiError.test.ts`**
  - `normalises a string message`: `new ApiError(401, { message: 'Invalid credentials' })` gives `messages` equal to `['Invalid credentials']` and `message` equal to `'Invalid credentials'`.
  - `normalises a validation array`: body `{ message: ['email must be an email', 'password must be longer than or equal to 8 characters'] }` gives `messages.length === 2`, and `fieldErrors()` equals `{ email: 'email must be an email', password: 'password must be longer than or equal to 8 characters' }`.
  - `fieldErrors ignores non-field messages`: `['User already exists']` gives `{}`. (`User` is capitalised, so it is not a field.)
  - `retryAfterSeconds reads the header`: headers `{ 'retry-after': '120' }` gives `120`. Headers `{}` give `null`. `'abc'` gives `null`.
  - `falls back when body is empty`: `new ApiError(500, undefined, {}, 'Network Error')` gives `message === 'Network Error'`.
- [ ] **Step 2: Run** `npx vitest run src/auth/apiError.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the interface above. In `apiClient.ts`, construct it with `new ApiError(status, err.response?.data, normaliseHeaders(err.response?.headers), err.message)`, where `normaliseHeaders` lowercases the keys of the axios headers into a plain object. Update the existing apiClient test `maps a 400 to ApiError…` to drop `code`.
- [ ] **Step 4: Run** `npx vitest run src/auth`. Expected: PASS.
- [ ] **Step 5: Commit** `refactor(auth): normalise ApiError messages, headers and field errors`

### Task 2: `authChannel` transport

**Files:**
- Create: `src/auth/authChannel.ts`
- Test: `src/auth/authChannel.test.ts`

**Interfaces:**
- Produces:
  - `type SignOutReason = 'expired' | 'revoked' | 'user'` (exported here; other modules import it from this file)
  - `type AuthMessage = { type: 'token'; res: TokenResponseDto } | { type: 'logout'; reason: SignOutReason }`
  - `authChannel.post(msg: AuthMessage): void`
  - `authChannel.subscribe(handler: (msg: AuthMessage) => void): () => void` (returns an unsubscribe function)
- This module is pure transport and must not import `tokenStorage` or `apiClient`, which avoids an import cycle. It lazily creates `new BroadcastChannel('auth')`. If `typeof BroadcastChannel === 'undefined'`, both functions do nothing.

- [ ] **Step 1: Write failing tests**
  - `delivers posted messages to subscribers in another channel instance`: stub `globalThis.BroadcastChannel` with a fake in-memory bus. `post({type:'logout', reason:'user'})` from module instance A reaches the handler of instance B, which you get with `vi.resetModules()` and a re-import.
  - `does not deliver to its own subscribers` (BroadcastChannel semantics; the fake must copy this).
  - `is a no-op without BroadcastChannel`: `vi.stubGlobal('BroadcastChannel', undefined)`, then `post` does not throw and `subscribe` returns a function.
- [ ] **Step 2: Run** `npx vitest run src/auth/authChannel.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/auth/authChannel.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(auth): add BroadcastChannel transport for tab sync`

### Task 3: Memory-only `tokenStorage` with refresh timer; types and config

**Files:**
- Modify: `src/auth/tokenStorage.ts` (rewrite)
- Modify: `src/types/auth.ts` (drop `refresh_token` from `TokenResponseDto`; delete `RefreshTokenRequest` and `LogoutRequest`; add `email_verified: boolean` to `UserProfileDto`; delete `ErrorResponse` if unused)
- Modify: `src/const/auth.ts` (delete `STORAGE_KEYS`; add `REVOKE: '/auth/revoke'`)
- Modify: `src/lib/env.ts` (default `http://localhost:3000`; strip one trailing `/` from whatever value is used); `.env.example` (`VITE_API_URL=http://localhost:3000`)
- Test: `src/auth/tokenStorage.test.ts` (rewrite)

**Interfaces:**
- Consumes: `authChannel.post`, `AuthMessage` (Task 2)
- Produces:
  - `tokenStorage.getAccessToken(): string | null`
  - `tokenStorage.getExpiresAt(): number | null`
  - `tokenStorage.getVersion(): number`
  - `tokenStorage.set(res: TokenResponseDto, opts?: { broadcast?: boolean }): void` (default `broadcast: true`, which posts `{type:'token', res}`)
  - `tokenStorage.clear(opts?: { broadcast?: boolean; reason?: SignOutReason }): void` (default `broadcast: true`, which posts `{type:'logout', reason: opts.reason ?? 'user'}`)
  - `tokenStorage.onRefreshDue(fn: () => void): void` (registers the single callback the timer calls)
  - Both `set` and `clear` increment the version. `set` replaces any pending timer. `clear` cancels it.
- Breaks the old `setAccessToken`, `setRefreshToken` and `setTokenResponse` names. Leave callers broken until Tasks 4 and 5. Run only the tests named here.

- [ ] **Step 1: Rewrite tests** (`vi.mock('./authChannel')`, `vi.useFakeTimers()`)
  - `never touches localStorage`: spy on `Storage.prototype.setItem` and `getItem`, call `set` and `clear`, and expect 0 calls.
  - `set stores token and expiresAt`: system time `2026-05-08T00:00:00Z`, `set({access_token:'a', expires_in:900, token_type:'Bearer'})`, then `getExpiresAt()` is `+15min`.
  - `schedules refresh at expires_in − 60s`: register `fn`, `set` with 900, advance 839 999 ms (fn not called), advance 1 ms (fn called once).
  - `never schedules sooner than 5s`: `expires_in: 30` gives a call at 5 000 ms.
  - `clear cancels the timer and bumps version`.
  - `set broadcasts by default; {broadcast:false} does not`.
  - `clear broadcasts logout with reason, default 'user'`.
- [ ] **Step 2: Run** `npx vitest run src/auth/tokenStorage.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `tokenStorage`, the type, const and env changes.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: No commit.** The tree does not type-check yet (see Global Constraints). Task 5 commits.

### Task 4: `apiClient` cookie refresh, cross-tab single-flight and sign-out

**Files:**
- Modify: `src/auth/apiClient.ts`
- Modify: `src/pages/auth/api.ts` (`refresh()` and `logout()` take no args and send no body; add `revoke()`)
- Test: `src/auth/apiClient.test.ts` (rewrite the refresh-flow block)

**Interfaces:**
- Consumes: `tokenStorage` (Task 3), `authChannel` and `SignOutReason` (Task 2), `ApiError` (Task 1)
- Produces:
  - `apiClient` (axios instance, `withCredentials: true`, `baseURL: env.apiUrl`)
  - `refreshAccessToken(): Promise<void>`
  - `signOut(reason: SignOutReason): void`, which calls `tokenStorage.clear({ reason })` and dispatches `new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { reason } })`
  - `AUTH_LOGOUT_EVENT = 'auth:logout'`
  - `AUTH_TOKEN_EVENT = 'auth:token'`, dispatched when a token arrives from another tab
  - `authApi.refresh(): Promise<TokenResponseDto>`, `authApi.logout(): Promise<void>`, `authApi.revoke(): Promise<void>`
- Behaviour:
  - Single-flight: `refreshAccessToken` keeps one shared promise per tab. Inside it, run `navigator.locks?.request('auth-refresh', cb) ?? cb()`. In `cb`, if `tokenStorage.getVersion() !== versionAtStart && tokenStorage.getAccessToken()`, return without a network call. Otherwise call `authApi.refresh()` and then `tokenStorage.set(res)`.
  - On refresh failure, rethrow. Do not clear here; `signOut` owns clearing.
  - The 401 interceptor skips `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/revoke` and `/auth/logout`.
  - On a 401 from a protected request that hasn't been retried: refresh, then replay once. If the refresh fails, or the replay returns 401, call `signOut(reasonFrom(error))` and reject with the original `ApiError`.
  - `reasonFrom`: if any message is `Session not found or revoked` or `Session is no longer active`, return `'revoked'`; otherwise `'expired'`.
  - At module load: `tokenStorage.onRefreshDue(() => void refreshAccessToken().catch((e) => signOut(reasonFrom(e))))`.
  - `authChannel.subscribe`: a `token` message calls `tokenStorage.set(res, {broadcast:false})` and dispatches `AUTH_TOKEN_EVENT`. A `logout` message calls `tokenStorage.clear({broadcast:false})` and dispatches `AUTH_LOGOUT_EVENT` with that reason.

- [ ] **Step 1: Rewrite the refresh tests** (mock `./authChannel`; use `MockAdapter` on `apiClient` for `/auth/refresh` too, with no `axios.post` spy)
  - `instance sends credentials`: `apiClient.defaults.withCredentials === true`.
  - `refresh posts with no body`: the `/auth/refresh` handler asserts `config.data` is `undefined` or `'{}'`, and that the config has no `refresh_token`.
  - `on 401, refreshes and replays once`: the replay has `Bearer new`.
  - `5 parallel 401s → one /auth/refresh` (keep the existing test, re-pointed at the mock adapter).
  - `timer refresh and a 401 at the same moment → one /auth/refresh` (Review Focus 1): fake timers, `set` with `expires_in: 61` (so the timer fires at 5 s), advance 5 s while a `/budgets` 401 is pending, and count 1 refresh request.
  - `uses navigator.locks when present`: `Object.defineProperty(navigator, 'locks', { value: { request: vi.fn((_n, cb) => cb()) }, configurable: true })` and expect `request` to have been called with `'auth-refresh'`.
  - `skips the network when another tab refreshed while waiting for the lock`: the lock stub calls `tokenStorage.set(...)` (simulating a broadcast) before `cb()`, and the refresh adapter is called 0 times.
  - `refresh 401 → signOut('expired')`: the event `detail.reason === 'expired'` and `getAccessToken()` is `null`.
  - `401 "Session not found or revoked" → reason 'revoked'`.
  - `replay returning 401 → signOut` (finding T11).
  - `does not refresh on 401 from /auth/logout or /auth/revoke`.
  - `incoming token broadcast sets token and dispatches auth:token` (Review Focus 3): capture the handler passed to the mocked `authChannel.subscribe` and call it.
  - `incoming logout broadcast clears without re-broadcasting`: `authChannel.post` is not called.
- [ ] **Step 2: Run** `npx vitest run src/auth/apiClient.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the `apiClient.ts` and `pages/auth/api.ts` changes.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: No commit.** Task 5 commits.

### Task 5: `AuthProvider` startup, logout, session-end redirect; `RequireAuth` splash

**Files:**
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/auth/RequireAuth.tsx`; move `LoadingFallback` from `src/App.tsx` to `src/components/common/LoadingFallback.tsx` and import it in both places
- Modify: `src/components/bills/NewBillModal.tsx:69-73` (on 401, only `onOpenChange(false)`, with no toast)
- Modify: `src/i18n/locales/en/errors.json`: `"sessionExpired": "Your session ended, please sign in again"`, `"signedOutElsewhere": "You were signed out"`
- Test: `src/contexts/AuthContext.test.tsx` (rewrite), `src/auth/RequireAuth.test.tsx` (update the first case), `src/components/bills/NewBillModal.test.tsx` (if it asserts the 401 toast)

**Interfaces:**
- Consumes: `refreshAccessToken`, `signOut`, `AUTH_LOGOUT_EVENT`, `AUTH_TOKEN_EVENT` (Task 4); `tokenStorage.set` and `getAccessToken` (Task 3); `authApi` (Task 4)
- Produces (the `useAuth()` shape is unchanged): `{ user: UserProfileDto | null | undefined; isAuthenticated: boolean; login(p: LoginRequest): Promise<void>; register(p: RegisterRequest): Promise<void>; logout(): Promise<void> }`. `login` and `register` reject with `ApiError` and are used by Tasks 7 and 8.
- `AuthProvider` must render inside `BrowserRouter` and `QueryClientProvider` (it already does in `main.tsx`). It uses `useNavigate`, `useLocation`, `useQueryClient` and `useTranslation('errors')`.
- Behaviour:
  - **Startup:** `refreshAccessToken()`, then `authApi.me()`, then `setUser`. Any error sets `null` with no toast. Do not use a `cancelled` flag that drops the second StrictMode result. Both mounts share the in-flight promise, and whichever resolves sets the user.
  - **`login` / `register`:** call the API, then `tokenStorage.set(res)`, then `me()`, then `setUser`.
  - **`logout`:** if there is an access token, `authApi.logout()`, else `authApi.revoke()`. If that throws, `authApi.revoke().catch(() => {})`. Finally, `signOut('user')`. Never throws.
  - **On `AUTH_LOGOUT_EVENT`:** let `wasSignedIn` be the current user (read via a ref). Then `setUser(null)` and `queryClient.clear()`. If `wasSignedIn`, `navigate('/login', { replace: true, state: { from: location, reason } })`, and toast by reason: `expired` uses `errors:sessionExpired`, `revoked` uses `errors:signedOutElsewhere`, `user` shows none.
  - **On `AUTH_TOKEN_EVENT`:** if the user is `null`, call `me()` and `setUser`.
  - Remove the `storage` listener.
  - **`RequireAuth`:** while the user is `undefined`, render `<LoadingFallback />`.

- [ ] **Step 1: Rewrite tests.** Use a render helper that wraps the tree in `MemoryRouter` + `QueryClientProvider` + `Routes` with `/login` showing `login-page`. Mock `@/pages/auth/api`, plus `refreshAccessToken` via `vi.mock('@/auth/apiClient', …)` that keeps the real `AUTH_*` constants and `signOut`. Mock `@/hooks/use-toast`.
  - `startup always refreshes then loads me`: `refreshAccessToken` is called once, then `me`, then `hello A`.
  - `startup refresh 401 → logged-out, no toast`.
  - `StrictMode double mount → one refresh, signed in` (Review Focus 2): wrap in `<StrictMode>`, and the mocked `refreshAccessToken` returns the same promise for both calls.
  - `login stores token then loads me`.
  - `logout calls /auth/logout when a token exists, then lands on /login without toast`.
  - `logout falls back to revoke when logout rejects`.
  - `logout with no access token calls revoke only` (Review Focus 4).
  - `two logout clicks do not throw` (Review Focus 4): `await Promise.all([logout(), logout()])` resolves.
  - `auth:logout {reason:'expired'} while signed in → /login + sessionExpired toast + query cache cleared`: spy on `queryClient.clear`.
  - `auth:logout {reason:'revoked'} → signedOutElsewhere toast`.
  - `auth:logout while already signed out → no navigation, no toast`.
  - `auth:token while signed out → loads me and signs in` (Review Focus 3).
  - Update `RequireAuth`: `shows loading fallback while user is undefined` (text `Loading...`).
- [ ] **Step 2: Run** `npx vitest run src/contexts src/auth src/components/bills`. Expected: FAIL.
- [ ] **Step 3: Implement** the `AuthContext`, `RequireAuth`, `LoadingFallback`, `NewBillModal` and `errors.json` changes.
- [ ] **Step 4: Run** `npm run type-check && npm run lint && npm run test:run`. Expected: all PASS. This is the first point where the whole tree compiles again.
- [ ] **Step 5: Commit Tasks 3–5 together** with the message `refactor(auth): in-memory tokens, cookie refresh with cross-tab single-flight, redirect to sign in when the session ends`

### Task 6: Auth i18n keys

**Files:**
- Modify: `src/i18n/locales/en/auth.json`

Fold into Task 7 if preferred. It is separate only so Tasks 7 and 8 can be implemented in parallel.

- [ ] **Step 1: Add the keys** under `auth`:
  - `errors.invalidCredentials`: "Email or password is incorrect"
  - `errors.accountLocked`: "Too many failed attempts. Try again in {{seconds}} s"
  - `errors.tooManyRequests`: "Too many attempts, try again in a minute"
  - `errors.userExists`: "An account with this email already exists"
  - `errors.signInInstead`: "Sign in instead"
  - `errors.generic`: "Something went wrong, please try again"
  - `register.checkInbox`: "Check your inbox to confirm your email"
  - change `register.fields.passwordHint` to "At least 8 characters"
- [ ] **Step 2: Run** `npm run test:run`. Expected: PASS (no test depends on the old hint).
- [ ] **Step 3: Commit** `feat(auth): add auth error and notice translations`

### Task 7: Sign-up schema and form errors

**Files:**
- Modify: `src/lib/validation-schemas.ts`
- Delete: `src/lib/validation.ts` (check first with `grep -rn "lib/validation'" src` that nothing imports it)
- Modify: `src/pages/auth/Register.tsx`
- Test: `src/lib/validation-schemas.test.ts` (new), `src/pages/auth/Register.test.tsx` (new)

**Interfaces:**
- Consumes: `useAuth().register` (Task 5), `ApiError.fieldErrors()` and `.messages` (Task 1), the i18n keys (Task 6)
- Produces: `registerSchema` and `loginSchema` (same export names). `firstNameSchema` keeps its name, with the new rules.

- [ ] **Step 1: Write the failing schema tests**
  - Accepts `correct-horse-battery` (no uppercase or symbol).
  - Rejects a 7-character password.
  - Accepts 24 × `'ж'` (48 bytes). Accepts 36 × `'ж'` (72 bytes exactly). Rejects 37 × `'ж'` (74 bytes).
  - Accepts first name `'A'`. Rejects `'   '`. Rejects 256 characters.
  - Rejects a `last_name` of 256 characters. Accepts `undefined`.
  - `loginSchema` accepts password `'abc'` (non-empty only).
- [ ] **Step 2: Write the failing `Register` tests** (mock `useAuth`; wrap in `MemoryRouter`; mock `toast`)
  - `400 User already exists → email field error with a link to /login`: `getByText('An account with this email already exists')`, and `getByRole('link', {name:'Sign in instead'})` has `href` `/login`.
  - `400 validation array → errors under the matching fields`: `['first_name should not be empty']` shows under First Name.
  - `429 → tooManyRequests toast`.
  - `success → checkInbox toast and navigate to /dashboard`.
  - `omits empty optional fields from the payload` (keep current behaviour): `register` is called with no `last_name` key.
- [ ] **Step 3: Run** `npx vitest run src/lib src/pages/auth`. Expected: FAIL.
- [ ] **Step 4: Implement.** Use `form.setError(field, { message })` for field errors. Show unknown errors as an `auth:errors.generic` toast. Render the link under the email `FormMessage` only when the error is `userExists`.
- [ ] **Step 5: Run** `npm run type-check && npm run lint && npm run test:run`. Expected: PASS.
- [ ] **Step 6: Commit** `fix(auth): align sign-up validation and errors with the API`

### Task 8: Sign-in errors and lockout countdown

**Files:**
- Modify: `src/pages/auth/Login.tsx`
- Create: `src/pages/auth/useCountdown.ts`
- Test: `src/pages/auth/Login.test.tsx` (new), `src/pages/auth/useCountdown.test.ts` (new)

**Interfaces:**
- Consumes: `useAuth().login` (Task 5), `ApiError` (Task 1), the i18n keys (Task 6)
- Produces: `useCountdown(): { secondsLeft: number; start(seconds: number): void }`. It ticks once per second down to 0 with `setInterval`, and clears the interval at 0 and on unmount.
- Behaviour:
  - A 401 shows a form-level error `auth:errors.invalidCredentials` (an inline `role="alert"` above the button, not a toast). Keep the email and call `form.resetField('password')`.
  - A 429 whose `messages[0]` is `Too many failed login attempts, try again later` calls `start(err.retryAfterSeconds() ?? 60)`.
  - Any other 429 shows the `tooManyRequests` toast.
  - A 400 sets field errors.
  - Anything else shows a `generic` toast.
  - Submit is disabled while `isLoading || secondsLeft > 0`, and the `accountLocked` text is shown with `{{seconds}}`.
  - Redirect after success is unchanged: to `state.from.pathname`, else `/dashboard`.

- [ ] **Step 1: Write failing `useCountdown` tests** (fake timers, `renderHook`)
  - `start(3)` gives `secondsLeft` 3, then 2 after 1 s, then 0 after 3 s, with no further ticks (Review Focus 5).
  - `clears interval on unmount`: spy on `clearInterval`.
- [ ] **Step 2: Write failing `Login` tests**
  - `401 → "Email or password is incorrect", password cleared, email kept`.
  - `lockout 429 with Retry-After 120 → submit disabled, shows 120`.
  - `lockout 429 without header → 60 s fallback`.
  - `submit re-enabled when countdown ends` (Review Focus 5).
  - `throttler 429 → tooManyRequests toast, submit stays enabled`.
  - `success → navigates to state.from`.
- [ ] **Step 3: Run** `npx vitest run src/pages/auth`. Expected: FAIL.
- [ ] **Step 4: Implement** `useCountdown` and the `Login` changes.
- [ ] **Step 5: Run** `npm run type-check && npm run lint && npm run test:run`. Expected: PASS.
- [ ] **Step 6: Commit** `fix(auth): generic sign-in error and lockout countdown`

### Task 9: Cleanup and end-to-end check

**Files:**
- Modify: anything still referencing removed names. Check with `grep -rn "refresh_token\|accounting_app_refresh_token\|setTokenResponse\|STORAGE_KEYS\|localStorage" src`, which must return only unrelated hits (for example `billDraftStore`, if any).
- Modify: `src/hooks/use-api.ts` (example hook; leave it, or delete it if unused per `grep -rn useExampleData src`)

- [ ] **Step 1: Run the grep above.** Expected: no auth-related hits.
- [ ] **Step 2: Run** `npm run type-check && npm run lint && npm run format:check && npm run test:run`. Expected: all PASS.
- [ ] **Step 3: Manual check.** Run the backend with `FRONTEND_URL=http://localhost:5173` and `JWT_EXPIRES_IN_MS=120000`, then `npm run dev`:
  1. Register with password `correct-horse-battery`. You land on `/dashboard` and see the inbox toast. DevTools shows the `refresh_token` cookie as HttpOnly with path `/auth`, and `localStorage` is empty.
  2. Reload. You stay signed in, with one `/auth/refresh` request and then `/auth/me`.
  3. Open a second tab and wait 2 minutes. Each refresh is a single request across both tabs, and there is no `Refresh token reuse detected` error.
  4. Sign out in tab 1. Tab 2 lands on `/login` with no toast.
  5. Sign in, then call `DELETE /auth/sessions/{id}` from another client. The next action shows "You were signed out" on `/login`.
  6. Enter a wrong password 6 times. The countdown appears and submit is disabled.
- [ ] **Step 4: Commit** any leftover cleanup: `chore(auth): remove legacy refresh-token storage references`
