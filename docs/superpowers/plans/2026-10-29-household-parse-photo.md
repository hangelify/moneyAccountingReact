# Households in the New Bill Flow: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the user's households, add a household picker to the New Bill modal, move every data call under `/households/{hid}`, and make the scan → review → confirm flow work against the new parse-photo API.

**Architecture:**
- `HouseholdProvider` (inside `AuthProvider`) holds the sorted list and one active `hid`, remembered in `localStorage`.
- API functions take `hid` as an argument. Hooks read it from the context and use `['households', hid, …]` query keys.
- The modal's picker writes the same active `hid`, so the whole app follows the switch.
- Parse-photo errors go through a pure `toParsePhotoFailure` mapper. The review page saves with confirm, or with create as the 422 fallback.

**Tech Stack:** React 18, TypeScript, Vite, TanStack Query, zustand, axios with `axios-mock-adapter`, Vitest and Testing Library, i18next (EN only).

**Spec:** `docs/superpowers/specs/2026-10-29-household-parse-photo-design.md`

## Global Constraints

- Branch is `refactor/parse-photo-households`. Commit after every task, with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `docs/` is gitignored. Add files under it with `git add -f`.
- Build every household path with `householdPath(hid, path)`, which returns `/households/${encodeURIComponent(hid)}${path}`. Never concatenate the path by hand.
- Every household query key starts with `['households', hid, …]`. The list itself is `['households']`.
- `localStorage` key: `activeHouseholdId`. Wrap every access in `try/catch`.
- The parse-photo request sends only the multipart field `image`, leaves `Content-Type` unset (`headers: { 'Content-Type': undefined }`, as today), and uses `timeout: 120_000`.
- Retry-After fallback order: header (`ApiError.retryAfterSeconds()`), then `/in (\d+) s/` in the message, then `30`.
- `unavailable` matches only a 503 with message exactly `Photo recognition is not available`, or a 429 whose message starts with `Daily AI budget exceeded`.
- New UI strings go only into `src/i18n/locales/en/*.json`. Tests assert the rendered English text, never raw keys (see commit `5c1ba84`).
- UI selects are native `<select>`, styled like `src/components/currency/CurrencySelect.tsx`. There is no Radix Select in `src/components/ui`.
- Commands: `npm run test:run -- <path>`, `npm run lint`, `npm run type-check`, `npm run build`.

## Review Focus

1. **Household switched while an upload is running** (from another tab). The draft must store the `hid` the photo was sent to, not the active one at response time. → Task 8, test `stores the hid the photo was sent to`.
2. **Sign out, then sign in as a different user.** The first user's remembered id must not leak into the second user's pick. → Task 3, test `clears the remembered id on sign-out`.
3. **Modal closed during a Retry-After countdown.** The interval must be cleared, with no state update after unmount. Reopening while time is left keeps Send disabled. → Task 8, test `keeps Send disabled after reopening during a countdown`.
4. **Modal opened before `GET /households` resolves.** Send stays disabled until the status is `ready`. Choosing a photo is still allowed. → Task 8, test `disables Send until households are loaded`.
5. **`Retry-After` sent as an HTTP date**, not seconds. `retryAfterSeconds()` returns `null`, so the mapper must fall back to the message or to 30, and never return `NaN`. → Task 6, test `falls back when Retry-After is an HTTP date`.

---

### Task 1: `ApiError` carries `url` and `code`; `isHouseholdForbidden`

**Files:**
- Modify: `src/auth/apiError.ts`, `src/auth/apiClient.ts` (the response interceptor, around line 168)
- Create: `src/auth/isHouseholdForbidden.ts`
- Test: `src/auth/apiError.test.ts`, `src/auth/apiClient.test.ts`, `src/auth/isHouseholdForbidden.test.ts`

**Interfaces:**
- Produces:
  - `new ApiError(status, body, headers?, fallbackMessage?, meta?: { url?: string; code?: string })`
  - `readonly url: string` (default `''`)
  - `readonly code: string | undefined`
  - `isHouseholdForbidden(err: unknown): boolean`

- [ ] **Step 1: Write failing tests**
  - `apiError.test.ts › stores url and code from meta`: `new ApiError(403, {}, {}, undefined, { url: '/households/x/bills', code: 'ERR_BAD_REQUEST' })` has `.url === '/households/x/bills'` and `.code === 'ERR_BAD_REQUEST'`. Without meta, it has `.url === ''` and `.code === undefined`.
  - `apiClient.test.ts › attaches request url and axios code to ApiError`: mock `onGet('/households/h1/markets').reply(403, { message: 'Forbidden' })`, then expect the rejection to match `{ status: 403, url: '/households/h1/markets' }`. Mock `.timeout()` on another URL and expect `code: 'ECONNABORTED'`.
  - `isHouseholdForbidden.test.ts`:
    - true for an `ApiError` with status 403 and url `/households/h1/bills`
    - false for 403 on `/auth/me`
    - false for 404 on `/households/h1`
    - false for a plain `Error`
- [ ] **Step 2: Run them and check they fail**
  - Run: `npm run test:run -- src/auth`
  - Expected: the new tests fail.
- [ ] **Step 3: Implement**
  - Add the `meta` parameter to `ApiError`.
  - In the interceptor, pass `{ url, code: err.code }`.
  - `isHouseholdForbidden` checks `err instanceof ApiError && err.status === 403 && err.url.startsWith('/households/')`.
- [ ] **Step 4: Run them and check they pass**
  - Run: `npm run test:run -- src/auth`
  - Expected: all tests pass, including the existing ones.
- [ ] **Step 5: Commit** `feat(auth): keep request url and axios code on ApiError`

### Task 2: Household types, constants, API and picker

**Files:**
- Create:
  - `src/types/households.ts`
  - `src/const/households.ts`
  - `src/pages/households/api.ts`
  - `src/pages/households/pickActiveHousehold.ts`
- Test:
  - `src/const/households.test.ts`
  - `src/pages/households/api.test.ts`
  - `src/pages/households/pickActiveHousehold.test.ts`

**Interfaces:**
- Produces:
  - `interface Household { id: string; name: string; created_at: string; member_count: number }`
  - `HOUSEHOLDS_ENDPOINTS = { LIST: '/households' } as const`
  - `ACTIVE_HOUSEHOLD_STORAGE_KEY = 'activeHouseholdId'`
  - `householdPath(hid: string, path = ''): string`
  - `householdsApi.list(): Promise<Household[]>`
  - `pickActiveHousehold(list: Household[], rememberedId: string | null): Household | null`
  - `readRememberedHouseholdId(): string | null`
  - `writeRememberedHouseholdId(id: string | null): void` (`null` removes the key)

- [ ] **Step 1: Write failing tests**
  - `householdPath('a b', '/bills')` returns `'/households/a%20b/bills'`, and `householdPath('h1')` returns `'/households/h1'`.
  - `householdsApi.list › sorts by created_at then name`: the mock returns `[{id:'b',name:'B',created_at:'2026-09-14T08:31:12.000Z'}, {id:'z',name:'Zed',created_at:'2026-06-03T12:00:00.000Z'}, {id:'a',name:'Alpha',created_at:'2026-06-03T12:00:00.000Z'}]` (each with `member_count`). The ids come back in the order `['a','z','b']`.
  - `pickActiveHousehold`:
    - remembered id in the list → that household
    - stale id → `list[0]`
    - `null` → `list[0]`
    - empty list → `null`
  - `readRememberedHouseholdId › returns null when localStorage throws`: use `vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error() })`. `writeRememberedHouseholdId` must not throw either.
- [ ] **Step 2: Run them and check they fail**
  - Run: `npm run test:run -- src/const/households.test.ts src/pages/households`
  - Expected: they fail because the modules don't exist.
- [ ] **Step 3: Implement** the modules with the signatures above. Sort a copy of the list with `a.created_at.localeCompare(b.created_at) || a.name.localeCompare(b.name)`.
- [ ] **Step 4: Run them and check they pass**
- [ ] **Step 5: Commit** `feat(households): types, path helper, list API and active picker`

### Task 3: `HouseholdContext`, provider mount, i18n namespace, test helper

**Files:**
- Create:
  - `src/contexts/HouseholdContext.tsx`
  - `src/i18n/locales/en/households.json`
  - `src/test/household.tsx`
- Modify:
  - `src/main.tsx` (wrap `<App />` and `<Toaster />` in `<HouseholdProvider>` inside `<AuthProvider>`)
  - `src/i18n/index.ts` (register the `households` namespace)
- Test: `src/contexts/HouseholdContext.test.tsx`

**Interfaces:**
- Consumes:
  - `useAuth().isAuthenticated`
  - `householdsApi.list`
  - `pickActiveHousehold`, `readRememberedHouseholdId`, `writeRememberedHouseholdId`
  - `isHouseholdForbidden`
  - `toast` from `@/hooks/use-toast`
- Produces:
  - `HouseholdContext` (exported, so tests can supply a value)
  - `HouseholdProvider`
  - `useHouseholds(): HouseholdContextValue` (throws outside the provider)
  - `useActiveHouseholdId(): string | null`
  - `HouseholdContextValue`, exactly as in spec §3.2
- Produces (test helper, `src/test/household.tsx`):
  - `TEST_HID = 'hh-1'`
  - `TEST_HOUSEHOLDS: Household[]`: two entries, `hh-1` "Personal" and `hh-2` "Family Budget"
  - `makeHouseholdValue(overrides?: Partial<HouseholdContextValue>): HouseholdContextValue`. Defaults: status `ready`, the first household active, `vi.fn()` actions.
  - `HouseholdTestProvider({ value?, children })`

**Behaviour notes:**
- `useQuery({ queryKey: ['households'], queryFn: householdsApi.list, enabled: isAuthenticated })`.
- **403 handling.** The provider subscribes once to `queryClient.getQueryCache()` and `getMutationCache()`. On an `error` result where `isHouseholdForbidden(error)` is true, it calls `handleForbidden()`. This is one central hook instead of per-hook calls, a refinement of spec §3.3. The review page still handles its own navigation in Task 9.
- `handleForbidden()` shares one in-flight promise: refetch, re-pick, then `toast({ variant: 'destructive', title: t('households:accessLost') })`.
- **Strings** in `households.json`:
  - `accessLost`: "You no longer have access to this household."
  - `loadFailed`: "Could not load your households."
  - `retry`: "Try again"

- [ ] **Step 1: Write failing tests.** Render the provider inside `QueryClientProvider` and a mocked `useAuth` (`vi.mock('@/contexts/AuthContext')`, with `isAuthenticated` toggled by a variable).
  - `does not fetch while signed out`: no GET `/households` is recorded.
  - `picks the remembered household when present`: `localStorage.activeHouseholdId = 'hh-2'`, so the active household is `hh-2`.
  - `re-validates a stale remembered id`: `'gone'` gives `hh-1`, and `localStorage` now holds `'hh-1'`.
  - `setActiveHouseholdId ignores unknown ids`: setting `'nope'` leaves the active household as `hh-1`.
  - `clears the remembered id on sign-out` (Review Focus 2): switch to `hh-2`, then set `isAuthenticated = false` and rerender. The key is gone and `status === 'idle'`.
  - `reports empty and error statuses`: `[]` gives `'empty'`; a 500 gives `'error'`.
  - `handleForbidden refetches once for parallel 403s`: two queries keyed `['households','hh-1','x']` reject with a 403 `ApiError` (url `/households/hh-1/x`). Assert that GET `/households` was called exactly twice (initial load plus one refetch), and that the text "You no longer have access to this household." appears once.
- [ ] **Step 2: Run them and check they fail**
  - Run: `npm run test:run -- src/contexts/HouseholdContext.test.tsx`
- [ ] **Step 3: Implement** the provider, the namespace, the `main.tsx` mount and the test helper.
- [ ] **Step 4: Run them and check they pass.** Also run `npm run test:run -- src/contexts` to confirm the AuthContext tests are unaffected.
- [ ] **Step 5: Commit** `feat(households): active household context`

### Task 4: Scope markets, sub-categories and bills reads under `hid`

**Files:**
- Modify:
  - `src/const/bills.ts`, `src/const/markets.ts`, `src/const/categories.ts`: paths become suffixes, for example `LIST: '/markets'` (used with `householdPath(hid, MARKETS_ENDPOINTS.LIST)`)
  - `src/pages/markets/api.ts`, `src/pages/categories/api.ts`, `src/pages/bills/api.ts` (`list`, `detail`)
  - `src/hooks/useMarkets.ts`, `useSubCategories.ts`, `useConfirmedBills.ts`, `useBillDetail.ts`
- Test (update the mocks to `/households/hh-1/…` and wrap renders in `HouseholdTestProvider`):
  - `src/pages/markets/api.test.ts`, `src/pages/categories/api.test.ts`, `src/pages/bills/api.test.ts`
  - `src/hooks/useSubCategories.test.tsx`
  - `src/components/categories/SubCategorySelect.test.tsx`, `src/components/markets/MarketMultiSelect.test.tsx`
  - `src/pages/bills/ConfirmedBills.test.tsx`, `BillDetailDrawer.test.tsx`, `components/BillDetailContent.test.tsx`, `components/ConfirmedBillsFilters.test.tsx`, `components/BillItemRow.test.tsx`

**Interfaces:**
- Consumes: `householdPath`, `useActiveHouseholdId`, `TEST_HID`, `HouseholdTestProvider`
- Produces:
  - `marketsApi.list(hid: string)`
  - `subCategoriesApi.list(hid: string)`
  - `billsApi.list(hid, filters, page, limit)`
  - `billsApi.detail(hid, id)`
- Produces (query keys):
  - `['households', hid, 'markets']`
  - `['households', hid, 'sub-categories']`
  - `['households', hid, 'bills', filters, page, limit]`
  - `['households', hid, 'bill', id]`
  - Every one of them has `enabled: hid !== null` (and `&& !!id` for the detail).
- `BILLS_ENDPOINTS` after this task: `PARSE_PHOTO: '/bills/parse-photo'`, `LIST: '/bills'`, `DETAIL: (id) => '/bills/${id}'`, `CONFIRM: (id) => '/bills/${id}/confirm'`. `CONFIRM` is used in Task 5.

- [ ] **Step 1: Update the existing tests to the new paths, and add one new test per hook**
  - `useSubCategories.test.tsx › does not fetch without an active household`: with `makeHouseholdValue({ activeHousehold: null, status: 'loading' })`, no request is recorded and the status is `'pending'`.
  - `ConfirmedBills.test.tsx › refetches for the new household after a switch`: rerender with `hh-2` active. The mock for `/households/hh-2/bills` is hit, and `hh-1`'s rows are no longer shown.
- [ ] **Step 2: Run them and check they fail**
  - Run: `npm run test:run -- src/pages src/hooks src/components`
  - Expected: path and 404-mock failures.
- [ ] **Step 3: Implement** the signature, key and `enabled` changes above. `NewBillModal` still calls `billsApi.parsePhoto(f)` until Task 8. Keep that compiling by leaving `parsePhoto`'s signature alone in this task.
- [ ] **Step 4: Run them and check they pass.** Also run `npm run type-check`.
- [ ] **Step 5: Commit** `refactor(api): scope markets, sub-categories and bills reads to the active household`

### Task 5: New bill types and the parse, confirm, create and remove API

**Files:**
- Modify: `src/types/bills.ts`, `src/pages/bills/api.ts`
- Test: `src/pages/bills/api.test.ts`

**Interfaces:**
- Produces (types, in `src/types/bills.ts`):
  - `ParsedBillItem` gains `id?: string`
  - `ParsedBill` has `draft_id`, `market_name`, `bill_date`, `currency`, `total_amount` and `items`. It replaces `ParsedBillResponse`, and `raw_extracted_text` is removed.
  - `ParsePhotoResponse extends ParsedBill { request_id: string | null; duplicate: boolean }`
  - `AiErrorBody { statusCode; error; message; request_id: string | null; parsed?: ParsedBill }`
  - `ConfirmBillItem`, `ConfirmBillRequest`: exactly as in §4.3 of the parse-photo guide
  - `CreateBillItem { sub_category_id: string; product_count: number; amount: number; product_weight?: number }`
  - `CreateBillRequest { market_id?; bill_date; currency?; total_amount; description?; items: CreateBillItem[] }`
- Produces (API):
  - `billsApi.parsePhoto(hid: string, file: Blob, opts?: { signal?: AbortSignal }): Promise<ParsePhotoResponse>`
  - `billsApi.confirm(hid: string, draftId: string, body: ConfirmBillRequest): Promise<BillDetailResponseDto>`
  - `billsApi.create(hid: string, body: CreateBillRequest): Promise<BillDetailResponseDto>`
  - `billsApi.remove(hid: string, id: string): Promise<void>`

- [ ] **Step 1: Write failing tests** in `api.test.ts`:
  - `POSTs only an "image" field to /households/hh-1/bills/parse-photo`: the mock reads `config.data` as `FormData`, `[...fd.keys()]` equals `['image']`, `config.timeout === 120000`, and the header has no `application/json` `Content-Type`.
  - `passes the abort signal`: aborting a controller rejects with `name` `'CanceledError'` (axios).
  - `confirm POSTs the body to /households/hh-1/bills/d1/confirm`.
  - `create POSTs to /households/hh-1/bills`.
  - `remove DELETEs /households/hh-1/bills/d1`.
- [ ] **Step 2: Run them and check they fail**
- [ ] **Step 3: Implement.** Rename `ParsedBillResponse` to `ParsedBill` everywhere: the store, the review components, and the tests. `npm run type-check` lists every place.
- [ ] **Step 4: Run** `npm run test:run -- src/pages/bills/api.test.ts` and `npm run type-check`. Both must pass, except for compile errors in `NewBillModal.tsx`, which Task 8 fixes. To keep the build green, update its call to `billsApi.parsePhoto(hid, f)` using `useActiveHouseholdId()` now, with a `hid` null-guard on Send.
- [ ] **Step 5: Commit** `feat(bills): household parse-photo, confirm, create and remove API`

### Task 6: `toParsePhotoFailure`

**Files:**
- Create: `src/pages/bills/parsePhotoError.ts`
- Test: `src/pages/bills/parsePhotoError.test.ts`

**Interfaces:**
- Consumes: `ApiError` (`status`, `body`, `code`, `message`, `retryAfterSeconds()`), `AiErrorBody`, `ParsedBill`
- Produces: `type ParsePhotoFailure`, exactly as in spec §3.7 (including `timedOut` on `failed`), and `toParsePhotoFailure(err: unknown): ParsePhotoFailure`

- [ ] **Step 1: Write failing tests** (build `ApiError`s directly):
  - `cancel`: an `Error` named `'CanceledError'` or `'AbortError'` gives `{ kind: 'cancelled' }`.
  - `401` gives `auth`, and `403` gives `forbidden`.
  - `413` and `415` give `bad-photo` with the server message.
  - The four 422 cases:
    - `request_id: null` gives `bad-photo`
    - "Please retake the photo" gives `bad-photo`
    - "The photo is not a receipt" gives `bad-photo`
    - a body with `parsed` gives `save-failed` with `parsed` and `requestId: 'r1'`
  - `429 with header Retry-After: 12` gives `retry-later` and `retryAfterSec: 12`.
  - `429 without the header and message "Too many requests. Try again in 41 s"` gives `retryAfterSec: 41`.
  - `503 without the header and with an unrelated message` gives `retryAfterSec: 30`.
  - `falls back when Retry-After is an HTTP date` (Review Focus 5): header `'Wed, 21 Oct 2026 07:28:00 GMT'` and no number in the message gives `retryAfterSec: 30`.
  - `503 "Photo recognition is not available"` gives `unavailable`.
  - `429 "Daily AI budget exceeded …"` gives `unavailable`, even when a `Retry-After` header is present. Budget beats the header, per §3.4 of the parse-photo guide.
  - `502` gives `failed` with `requestId` taken from `body.request_id`.
  - `status undefined, code 'ECONNABORTED'` gives `failed` and `timedOut: true`, with `requestId: null`.
  - `status undefined, other code` gives `failed` and `timedOut: false`.
- [ ] **Step 2: Run them and check they fail**
- [ ] **Step 3: Implement.** Check, in this order: cancelled, then not an `ApiError`, then the status switch. Inside the 429/503 branch, check `unavailable` before using the Retry-After value.
- [ ] **Step 4: Run them and check they pass**
- [ ] **Step 5: Commit** `feat(bills): map parse-photo errors to failure kinds`

### Task 7: Draft store and payload builders

**Files:**
- Modify: `src/stores/billDraftStore.ts`, `src/types/bills.ts` (`BillEditItem` gains `id?: string`)
- Create: `src/pages/bills/buildConfirmPayload.ts`
- Test: `src/stores/billDraftStore.test.ts`, `src/pages/bills/buildConfirmPayload.test.ts`

**Interfaces:**
- Produces (store):
  - fields `hid: string | null`, `draftId: string | null`, `mode: 'confirm' | 'create' | null`, `parsed: ParsedBill | null`
  - `setDraft(args: { file: File; parsed: ParsedBill; hid: string; mode: 'confirm' | 'create' }): void`
  - `draftId` is `parsed.draft_id` in confirm mode and `null` in create mode
  - `clear()` resets all of them
- Produces (builders):
  - `buildConfirmPayload(edits: BillEdits, today?: string): ConfirmBillRequest`
  - `buildCreatePayload(edits: BillEdits, today?: string): CreateBillRequest`, which throws when any item has no `sub_category`
  - `todayIso(): string` gives local `YYYY-MM-DD`

- [ ] **Step 1: Write failing tests**
  - Store:
    - `setDraft keeps line ids on edit items`
    - `setDraft in create mode leaves draftId null`
    - `clear resets hid, draftId and mode`
  - `buildConfirmPayload`, with `today = '2026-10-29'`:
    - item `{ id:'l1', sub_category:{id:'s1',…}, name:'BREAD', quantity:1, final_price:1.2, weight_kg:null }` becomes `{ id:'l1', sub_category_id:'s1', raw_name:'BREAD', product_count:1, amount:1.2 }`, with no `product_weight` key
    - `quantity: 0` becomes `product_count: 1`, and `quantity: 2.6` becomes `3`
    - `final_price: 8.987` becomes `amount: 8.99`, and `weight_kg: 1.23456` becomes `product_weight: 1.235`
    - `sub_category: null` means no `sub_category_id` key, and an empty name means no `raw_name` key
    - header: `market_name: 'Lidl'` gives `new_market: { name: 'Lidl' }`, and an empty name leaves out `new_market`
    - `bill_date: ''` becomes `'2026-10-29'`, and `currency: ''` leaves the key out
    - `total_amount: 10.194` becomes `10.19`
  - `buildCreatePayload`:
    - no `id`, `raw_name` or `new_market` keys
    - throws `Error('uncategorised')` when a line has no sub-category
- [ ] **Step 2: Run them and check they fail**
- [ ] **Step 3: Implement.** Use `Math.round(x * 100) / 100` and `Math.round(x * 1000) / 1000`. Update callers of `setDraft`. `NewBillModal` passes `{ file, parsed, hid, mode: 'confirm' }`, and Task 8 finishes the job.
- [ ] **Step 4: Run** `npm run test:run -- src/stores src/pages/bills` and `npm run type-check`. Expected: both pass.
- [ ] **Step 5: Commit** `feat(bills): draft store keeps household and draft id; confirm payload builders`

### Task 8: New Bill modal: picker, failures, cancel, countdown

**Files:**
- Modify:
  - `src/components/bills/NewBillModal.tsx`
  - `src/i18n/locales/en/bills.json`, `src/i18n/locales/en/errors.json`
- Create: `src/components/bills/HouseholdSelect.tsx` (native `<select>`, `id="household"`, label "Household")
- Test: `src/components/bills/NewBillModal.test.tsx` (wrap in `HouseholdTestProvider`; the existing tests move to the new URL)

**Interfaces:**
- Consumes:
  - `useHouseholds()`
  - `billsApi.parsePhoto(hid, file, { signal })`
  - `toParsePhotoFailure`
  - `setDraft({ file, parsed, hid, mode })`
  - `handleForbidden()`
- Produces: `HouseholdSelect({ households, value, onChange, disabled })`

**Strings (EN):**
- `bills:newBillModal.household`: "Household"
- `bills:newBillModal.noHousehold`: "No household available. New bills can't be added right now."
- `bills:newBillModal.duplicate`: "You already scanned this receipt. Continuing the existing draft."
- `bills:newBillModal.saveFailedFallback`: "The receipt was read, but the draft could not be saved. Check it and save it manually."
- `bills:newBillModal.retryIn`: "Try again in {{seconds}} s"
- `bills:newBillModal.cancelUpload`: "Cancel"
- `errors:reference`: "Reference: {{requestId}}"
- `errors:recognitionTimeout`: "Recognition is taking too long. Check your drafts in a moment."
- `errors:network`: "Network error. Check your connection and try again."
- `errors:recognitionFailed`: "Recognition failed"
- Remove `errors:aiUnavailable`.

**Behaviour notes:**
- The `hid` is captured when `mutate` is called: the mutation variable is `{ file, hid }`, and `onSuccess` uses `variables.hid`.
- The countdown deadline lives at module level, as `retryUntil: number | null`, so it survives closing and reopening the modal. A `useEffect` interval ticks the visible seconds and is cleared on unmount.
- `unavailable` sets a module-level `scanDisabled = true`.
- Export `__resetNewBillModalState()` for tests.

- [ ] **Step 1: Write failing tests**
  - `hides the household picker with one household` and `shows it with two`.
  - `switching the picker calls setActiveHouseholdId('hh-2')`.
  - `sends to /households/hh-1/bills/parse-photo and navigates to review`.
  - `stores the hid the photo was sent to` (Review Focus 1): send with `hh-1` active, rerender with `hh-2` active before the delayed reply resolves (`mock.onPost(...).reply(() => new Promise(r => setTimeout(() => r([200, body]), 50)))`). Expect `useBillDraftStore.getState().hid === 'hh-1'`.
  - `shows the duplicate toast when duplicate is true`.
  - `shows a bad-photo message inline and keeps the photo` (415, message "HEIC is not supported").
  - `falls back to review in create mode on 422 with parsed`: the store has `mode === 'create'` and `draftId === null`, and the fallback toast is shown.
  - `shows a countdown and re-enables Send` (429 with `Retry-After: 2`, using `vi.useFakeTimers({ shouldAdvanceTime: true })`): Send reads "Try again in 2 s" and is disabled, and after advancing 2 s it is enabled.
  - `keeps Send disabled after reopening during a countdown` (Review Focus 3).
  - `disables scanning when recognition is not available` (503, message "Photo recognition is not available").
  - `shows the reference code` (502 with `request_id: 'r-9'`): the toast contains "Reference: r-9".
  - `cancel aborts the upload and keeps the photo`.
  - `disables Send until households are loaded` (Review Focus 4): with `status: 'loading'`, a photo can be picked but Send is disabled.
  - `shows the no-household note when the list is empty`.
  - `offers a retry when households failed to load`: with `status: 'error'`, "Could not load your households." and a "Try again" button are shown, and the button calls `refetch`.
  - `calls handleForbidden on 403`.
  - The existing 401 tests keep passing on the new URL.
- [ ] **Step 2: Run them and check they fail**
  - Run: `npm run test:run -- src/components/bills`
- [ ] **Step 3: Implement.** The failure kinds map to the UI exactly as in the table in spec §3.7. Replace the 400/401/502 branches. For `auth`, keep the current "token cleared → close" logic.
- [ ] **Step 4: Run them and check they pass**
- [ ] **Step 5: Commit** `feat(bills): household picker and new parse-photo error handling in New Bill modal`

### Task 9: Review page: confirm, create fallback, discard, household guard

**Files:**
- Modify:
  - `src/pages/bills/NewBillReview.tsx`
  - `src/pages/bills/components/BillReviewFields.tsx` (accepts an optional `marketHint?: string`, shown under the market input)
  - `src/i18n/locales/en/bills.json`, `src/i18n/locales/en/errors.json`
- Test: `src/pages/bills/NewBillReview.test.tsx`

**Interfaces:**
- Consumes:
  - the store (`hid`, `draftId`, `mode`, `edits`, `clear`)
  - `useHouseholds()`
  - `billsApi.confirm`, `billsApi.create`, `billsApi.remove`
  - `buildConfirmPayload`, `buildCreatePayload`
  - `isHouseholdForbidden`
  - `useQueryClient().invalidateQueries({ queryKey: ['households', hid, 'bills'] })`

**Strings (EN):**
- `bills:review.otherHousehold`: "This draft belongs to {{name}}. Switch to that household to save it."
- `bills:review.saved`: "Bill saved"
- `bills:review.categoriseAll`: "Pick a category for every line before saving."
- `bills:review.marketNotSaved`: "The shop name can't be saved for this bill."
- `bills:review.draftGone`: "This draft no longer exists."
- `bills:review.alreadyConfirmed`: "This bill was already confirmed."
- `errors:saveFailed`: "Could not save the bill. Please try again."

- [ ] **Step 1: Write failing tests**
  - `confirms the draft with the built payload`: POST `/households/hh-1/bills/d1/confirm` gets a body equal to `buildConfirmPayload(edits, todayIso())`. Then the store is cleared, the path is `/bills/confirmed`, and "Bill saved" is shown.
  - `invalidates the household bills cache after save`: spy on `queryClient.invalidateQueries` and expect it to be called with `{ queryKey: ['households','hh-1','bills'] }`.
  - `create mode posts to /households/hh-1/bills and disables Save until every line has a category`.
  - `create mode shows the shop-name hint`.
  - `disables Save when the draft belongs to another household`: the store has `hid: 'hh-2'` while `hh-1` is active, and "This draft belongs to Family Budget." is shown.
  - `shows validation messages on 400`: `{ message: ['total_amount must be positive'] }` is shown above Save, and the store is kept.
  - `404 clears and goes to /dashboard with "This draft no longer exists."`.
  - `409 clears and goes to /bills/confirmed with "This bill was already confirmed."`.
  - `403 calls handleForbidden, clears and goes to /dashboard`.
  - `Cancel without edits deletes the draft`, and `Discard after edits deletes the draft`: DELETE `/households/hh-1/bills/d1` is recorded in both.
  - `Cancel in create mode sends no DELETE`.
  - `Save button is disabled while saving`.
- [ ] **Step 2: Run them and check they fail**
  - Run: `npm run test:run -- src/pages/bills/NewBillReview.test.tsx`
- [ ] **Step 3: Implement.**
  - `handleSave` runs a `useMutation` that branches on `mode`.
  - The discard path calls `void billsApi.remove(hid, draftId).catch(() => undefined)` before `clear()` and navigation.
  - Keep the existing unmount-clears-store effect. It must not delete the draft, because leaving by other means keeps it (spec §3.6).
- [ ] **Step 4: Run them and check they pass**
- [ ] **Step 5: Commit** `feat(bills): confirm or create the reviewed bill in the active household`

### Task 10: Whole-branch verification

**Files:** none new. Fix only what the checks report.

- [ ] **Step 1:** Run `npm run lint`. Expected: no errors.
- [ ] **Step 2:** Run `npm run type-check`. Expected: no errors.
- [ ] **Step 3:** Run `npm run test:run`. Expected: every test passes, with no "not wrapped in act" warnings from the new tests.
- [ ] **Step 4:** Run `npm run build`. Expected: the build succeeds.
- [ ] **Step 5:** Run `grep -rn "'/bills\|'/markets\|'/sub-categories" src --include=*.ts --include=*.tsx | grep -v test | grep -v "const/"`. Expected: no output. Every caller goes through `householdPath`.
- [ ] **Step 6:** Commit any fixes as `chore: lint and type fixes for household flow`. Skip this when there is nothing to commit.
