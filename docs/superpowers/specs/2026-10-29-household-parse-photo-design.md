# Households in the New Bill Flow — Design

- **Date:** 2026-10-29
- **Branch:** `refactor/parse-photo-households` (from `dev`)
- **Sources of truth (backend, Oct 2026):**
  - _Frontend Integration: Households — `GET /households`_, referred to below as **the households guide**
  - _Frontend Integration: Receipt Photo Parsing — `POST /households/{hid}/bills/parse-photo`_, referred to below as **the parse-photo guide**
- **Scope:** an active household for the app, a household picker in the New Bill modal, the new parse-photo call and its errors, and saving the draft from the review page (confirm, discard, the 422 fallback). Other data endpoints only move their URLs under `/households/{hid}`.
- **Approach chosen:** A. The picker in the modal sets the app-wide active household. There is one `hid` for the whole app, and every household query key includes it.

---

## 1. Summary

The backend now puts all financial data under a household: `/households/{hid}/bills`, `/markets`, `/sub-categories`, `/categories`, and so on. The frontend has no household concept. It calls `/bills/parse-photo`, `/bills`, `/markets` and `/sub-categories`, and none of these routes exist any more.

The parse-photo endpoint has also changed contract:

1. **It creates a server draft.** The response carries `draft_id`, an `id` per line, `duplicate` and `request_id`. `raw_extracted_text` is gone.
2. **Saving means confirming the draft** with `POST /households/{hid}/bills/{draft_id}/confirm`. Today the review page's `handleSave` is a `TODO`.
3. **Every error has the same body** (`statusCode`, `error`, `message`, `request_id`, optional `parsed`). There are four distinct 422 cases, plus 413, 415, 429 and 503, and `Retry-After` matters. The current modal handles 400, 401 and 502 only, and reads `requestId` in camelCase.

## 2. Files involved

| File | Role today | Change |
|---|---|---|
| `src/main.tsx` | Mounts `QueryClientProvider` → `AuthProvider` | Mount `HouseholdProvider` inside `AuthProvider` |
| `src/contexts/AuthContext.tsx` | Session state | Unchanged; the household provider reads `isAuthenticated` |
| `src/const/bills.ts`, `markets.ts`, `categories.ts` | Flat endpoint paths | Paths become relative to `householdPath(hid, …)` |
| `src/pages/bills/api.ts` | `billsApi.parsePhoto/list/detail` | Each takes `hid`; adds `confirm`, `create`, `remove` |
| `src/pages/markets/api.ts`, `src/pages/categories/api.ts` | Flat list calls | Take `hid` |
| `src/auth/apiError.ts`, `src/auth/apiClient.ts` | `ApiError(status, body, headers)` | Adds `url` and `code` (from the axios error) |
| `src/hooks/useMarkets.ts`, `useSubCategories.ts`, `useConfirmedBills.ts`, `useBillDetail.ts` | Unscoped query keys | `['households', hid, …]` keys, disabled while `hid` is `null` |
| `src/types/bills.ts` | Old parsed shape | New parse-photo, error and confirm types |
| `src/stores/billDraftStore.ts` | `file`, `parsed`, `edits` | Also stores `hid`, `draftId`, `mode`; items keep their line `id` |
| `src/components/bills/NewBillModal.tsx` | Upload + 400/401/502 handling | Picker, new call, failure kinds, cancel, countdown |
| `src/pages/bills/NewBillReview.tsx` | Save is a `TODO` | Confirm / create / discard |
| `src/i18n/locales/en/*.json` | EN strings | New keys (EN is the only locale) |

New files:

| File | Purpose |
|---|---|
| `src/types/households.ts` | `Household` |
| `src/const/households.ts` | `HOUSEHOLDS_ENDPOINTS`, `householdPath()`, `ACTIVE_HOUSEHOLD_STORAGE_KEY` |
| `src/pages/households/api.ts` | `householdsApi.list()` (sorted) |
| `src/pages/households/pickActiveHousehold.ts` | Pure picker |
| `src/contexts/HouseholdContext.tsx` | `HouseholdProvider`, `useHouseholds()`, `useActiveHouseholdId()` |
| `src/auth/isHouseholdForbidden.ts` | Detects a 403 from a `/households/{hid}/…` path |
| `src/pages/bills/parsePhotoError.ts` | `toParsePhotoFailure(err)` |
| `src/pages/bills/buildConfirmPayload.ts` | Review edits → `ConfirmBillRequest` / `CreateBillRequest` |

## 3. Target design

### 3.1 Household types and helpers

```ts
// src/types/households.ts
export interface Household {
  id: string;
  name: string;
  created_at: string; // ISO date
  member_count: number;
}
```

```ts
// src/const/households.ts
export const HOUSEHOLDS_ENDPOINTS = { LIST: '/households' } as const;
export const ACTIVE_HOUSEHOLD_STORAGE_KEY = 'activeHouseholdId';
export function householdPath(hid: string, path = ''): string {
  return `/households/${encodeURIComponent(hid)}${path}`;
}
```

- `householdsApi.list()` calls `GET /households`, which returns a plain array. It sorts a copy by `created_at`, then by `name`, because the backend doesn't sort.
- `pickActiveHousehold(list, rememberedId)` returns the remembered household if it is still in the list. Otherwise it returns `list[0]`, or `null` when the list is empty. Every `localStorage` access is wrapped in `try/catch`.

### 3.2 `HouseholdContext`

`HouseholdProvider` is mounted inside `AuthProvider`. It exposes:

```ts
interface HouseholdContextValue {
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  households: Household[];
  activeHousehold: Household | null;
  setActiveHouseholdId: (id: string) => void;
  handleForbidden: () => Promise<void>;
  refetch: () => Promise<void>;
}
```

- **Loading.** `useQuery({ queryKey: ['households'], enabled: isAuthenticated })`. A login (the `isAuthenticated` change) triggers the first fetch.
- **Active id.** Kept in React state and seeded from `localStorage`. Whenever the list changes, it is re-validated with `pickActiveHousehold`, and the resolved id is written back to `localStorage`.
- **`setActiveHouseholdId(id)`.** Ignores ids that are not in the list. It sets state and `localStorage`. There is no explicit cache purge: every household query key starts with `['households', hid]`, so data for the new `hid` loads on its own and the old household's data is never shown.
- **Sign-out** (`isAuthenticated` becomes false). Removes the `localStorage` key, calls `queryClient.removeQueries({ queryKey: ['households'] })`, and resets the state to `idle`.
- **`handleForbidden()`.** Refetches the list, re-picks the active household, and shows the toast `households:accessLost` once. Several 403s arriving in parallel collapse into one refetch through a shared promise.
- `useActiveHouseholdId()` returns `string | null`. It is `null` unless the status is `ready`.

### 3.3 Household-scoped data calls

- Every API function that touches household data takes `hid` as its first argument and builds its path with `householdPath(hid, …)`. API modules never read the context.
- The hooks read `useActiveHouseholdId()`, use keys like `['households', hid, 'markets']`, `['households', hid, 'sub-categories']`, `['households', hid, 'bills', filters, page, limit]` and `['households', hid, 'bill', id]`, and pass `enabled: hid !== null`.
- **403 handling.** `isHouseholdForbidden(err)` is true when `err` is an `ApiError` with status 403 and its request URL starts with `/households/`. To support this, `apiClient` records the request URL on `ApiError`, in a new `url` field. Hooks and mutations call `handleForbidden()` when it matches. The owner-only 403s that come with a message are not used by this flow.

### 3.4 New Bill modal

- **Picker.** When `households.length > 1`, a `Select` labelled `bills:newBillModal.household` sits above the dropzone. Its value is `activeHousehold.id`. Changing it calls `setActiveHouseholdId`. It is disabled while an upload is running.
- **No household.** When the status is `empty` or `error`, the modal shows `bills:newBillModal.noHousehold`, or an error with a retry button that calls `refetch()`. Send is disabled.
- **Send.** Calls `billsApi.parsePhoto(hid, file, { signal })` with:
  - `POST householdPath(hid, '/bills/parse-photo')`
  - `FormData` holding only `image`
  - `Content-Type` left unset, as the code does today
  - `timeout: 120_000`
- **Cancel during upload.** The pending overlay gets a Cancel button that calls `abortController.abort()`. Closing the dialog is still blocked while the request is running.
- **Success.**
  - Call `setDraft({ file, parsed, hid, mode: 'confirm' })`, then navigate to `/bills/review`.
  - If `parsed.duplicate`, show the toast `bills:newBillModal.duplicate` ("You already scanned this receipt. Continuing the existing draft.").
- **Failures.** See §3.7.

### 3.5 Draft store

```ts
interface BillDraftState {
  file: File | null;
  previewUrl: string | null;
  hid: string | null;
  draftId: string | null;            // null in 'create' mode
  mode: 'confirm' | 'create' | null;
  parsed: ParsedBill | null;
  edits: BillEdits;
  setDraft: (args: { file: File; parsed: ParsedBill; hid: string; mode: 'confirm' | 'create' }) => void;
  // updateEdits / updateItem / addItem / removeItem / clear unchanged
}
```

- `BillEditItem` gets an optional `id?: string`, taken from the parsed line. Lines added on the review page have no `id`.
- `ParsedBill` and `ParsePhotoResponse` follow §2.1 of the parse-photo guide. `raw_extracted_text` is removed.

### 3.6 Review page: save and discard

- **Household guard.** If `draft.hid !== activeHouseholdId` (for example, the user switched in another tab), the page shows `bills:review.otherHousehold` with that household's name, and Save is disabled. The draft's `hid` is never sent while a different household is active.
- **Payload.** `buildConfirmPayload(edits)` (pure) produces `ConfirmBillRequest`:

| Edit field | Payload field | Rule |
|---|---|---|
| `items[].id` | `items[].id` | Kept when present |
| `items[].sub_category?.id` | `items[].sub_category_id` | Left out when null |
| `items[].name` | `items[].raw_name` | Sent when non-empty |
| `items[].quantity` | `items[].product_count` | `max(1, round(quantity))`; a `0` or `null` becomes `1` |
| `items[].final_price` | `items[].amount` | Rounded to 2 decimals |
| `items[].weight_kg` | `items[].product_weight` | Rounded to 3 decimals; left out when null or 0 |
| `market_name` | `new_market: { name }` | Left out when empty |
| `bill_date` | `bill_date` | Today (`YYYY-MM-DD`, local time) when empty |
| `currency` | `currency` | Left out when empty |
| `total_amount` | `total_amount` | Rounded to 2 decimals |

- **Confirm mode.** `POST householdPath(hid, '/bills/{draftId}/confirm')`. On success: `clear()`, invalidate `['households', hid, 'bills']`, show the toast `bills:review.saved`, and navigate to `/bills/confirmed`.
- **Create mode** (the 422 fallback). `buildCreatePayload(edits)` is the same as above, without `id`, `raw_name` or `new_market`. Every line must have a `sub_category`. Save stays disabled, with the hint `bills:review.categoriseAll`, until they all do. A market name cannot be saved in this mode, because `CreateBillDto` only accepts `market_id`. The market field shows the hint `bills:review.marketNotSaved`. Then `POST householdPath(hid, '/bills')`, with the same success handling.
- **Errors (confirm and create).**
  - 400: show the `ApiError.messages` inline above the Save button.
  - 403: `handleForbidden()`, then `clear()` and navigate to `/dashboard`.
  - 404 (confirm only): toast `bills:review.draftGone`, `clear()`, navigate to `/dashboard`.
  - 409 (confirm only): toast `bills:review.alreadyConfirmed`, `clear()`, navigate to `/bills/confirmed`.
  - Other errors: toast `errors:saveFailed`. Edits are kept.
- **Discard (confirm mode).** After the existing "discard changes?" confirmation, call `DELETE householdPath(hid, '/bills/{draftId}')`, without waiting for it. Errors are ignored, because the backend expires drafts after 30 days anyway. Then `clear()` and navigate.
  - A Cancel without edits also deletes the draft. The draft exists on the server whether or not the user edited it.
  - Leaving the page any other way (a nav link, sign-out) keeps the draft on the server. It can be resumed once a drafts list exists (future work).

### 3.7 Parse-photo failures

`toParsePhotoFailure(err: unknown): ParsePhotoFailure` is a pure function in `src/pages/bills/parsePhotoError.ts`. It works on our `ApiError`, not on raw axios errors, because the interceptor already wraps them. Cancellation shows up as an `AbortError` or `CanceledError`, which the function detects before checking for `ApiError`.

```ts
export type ParsePhotoFailure =
  | { kind: 'auth' }                                                     // 401 after refresh failed
  | { kind: 'forbidden' }                                                // 403
  | { kind: 'bad-photo'; message: string }                               // 413, 415, 422 w/o parsed
  | { kind: 'save-failed'; parsed: ParsedBill; requestId: string | null }// 422 with parsed
  | { kind: 'retry-later'; message: string; retryAfterSec: number }      // 429/503 with a delay
  | { kind: 'unavailable'; message: string }                             // 503 not configured, 429 budget
  | { kind: 'failed'; message: string; requestId: string | null; timedOut: boolean } // 400, 502, network, timeout
  | { kind: 'cancelled' };
```

- `retryAfterSec` comes from `ApiError.retryAfterSeconds()` first. If that is missing (CORS hides `Retry-After`, see §3.4 of the parse-photo guide), it comes from `/in (\d+) s/` in the message, then defaults to 30.
- `unavailable` means a 503 whose message is exactly `Photo recognition is not available`, or a 429 whose message starts with `Daily AI budget exceeded`.
- `timedOut` is true when axios reports `ECONNABORTED`. `apiClient` keeps `code` on `ApiError` (a new `code` field) for this.

What the modal does with each kind:

| Kind | UI |
|---|---|
| `auth` | Existing behaviour: when the token was cleared, close the modal (AuthProvider redirects); otherwise show the `errors:uploadFailed` toast |
| `forbidden` | `handleForbidden()`; keep the photo, so the user can send it to the newly picked household |
| `bad-photo` | Inline error under the dropzone with the server `message`; keep the photo |
| `save-failed` | `setDraft({ …, parsed, mode: 'create' })`, show the toast `bills:newBillModal.saveFailedFallback`, navigate to review. Never ask for a re-upload |
| `retry-later` | Destructive toast with `message`. Send shows a countdown (`bills:newBillModal.retryIn`, N s) and is disabled until it ends. No automatic retry |
| `unavailable` | Destructive toast with `message`. Send stays disabled until a page reload (module-level flag) |
| `failed` | Destructive toast with `message`, or `errors:recognitionTimeout` when `timedOut`, or `errors:network` with no response |
| `cancelled` | Nothing; the overlay closes and the photo stays |

When there is a `requestId`, the toast description adds `errors:reference` ("Reference: {{requestId}}"). The current `errors:aiUnavailable` key, which reads `requestId` in camelCase, is replaced.

### 3.8 i18n (EN)

- `households.json` (new namespace, registered in `src/i18n/index.ts`):
  - `accessLost`
  - `loadFailed`
  - `retry`
- `bills.json`:
  - `newBillModal.household`, `newBillModal.noHousehold`, `newBillModal.duplicate`, `newBillModal.saveFailedFallback`, `newBillModal.retryIn`, `newBillModal.cancelUpload`
  - `review.otherHousehold`, `review.saved`, `review.categoriseAll`, `review.marketNotSaved`, `review.draftGone`, `review.alreadyConfirmed`
- `errors.json`:
  - `reference`, `recognitionTimeout`, `network`, `saveFailed`
  - `aiUnavailable` is removed

## 4. Data flow

```
login ─▶ HouseholdProvider: GET /households ─▶ sort ─▶ pickActiveHousehold(list, localStorage)
                                                         │ hid
New bill ─▶ NewBillModal [Select if >1 → setActiveHouseholdId]
         ─▶ POST /households/{hid}/bills/parse-photo (image only, 120 s, abortable)
              ├─ 200 ─▶ setDraft({file, parsed, hid, mode:'confirm'}) ─▶ /bills/review
              ├─ 422+parsed ─▶ setDraft({…, mode:'create'}) ─▶ /bills/review
              └─ other ─▶ toParsePhotoFailure ─▶ inline / toast / countdown / handleForbidden
/bills/review (hid === draft.hid)
         ─▶ Save: confirm → POST …/bills/{draftId}/confirm   | create → POST …/bills
         ─▶ Cancel: DELETE …/bills/{draftId} (fire-and-forget) ─▶ clear
```

## 5. Testing

Test-first with Vitest, Testing Library and `axios-mock-adapter`, following the existing tests.

- **Unit.**
  - `householdPath`: encoding
  - `householdsApi.list`: sort order, including the tie on `name`
  - `pickActiveHousehold`: remembered id, stale id, empty list, `localStorage` throwing
  - `isHouseholdForbidden`
  - `toParsePhotoFailure`: each status, the four 422 cases, `Retry-After` from the header, from the message and the 30 s default, budget, not configured, timeout, cancel
  - `buildConfirmPayload` / `buildCreatePayload`: rounding, `quantity` fallback, nulls left out, default date
- **`HouseholdContext`.**
  - fetches after login
  - re-validates a stale remembered id
  - `setActiveHouseholdId` ignores unknown ids
  - sign-out clears the key and the cache
  - `handleForbidden` refetches once for parallel calls and shows the toast once
  - empty and error statuses
- **`NewBillModal`.**
  - the picker is hidden with one household and shown with two; switching changes the request URL
  - the request goes to `/households/{hid}/bills/parse-photo` with only `image`
  - the duplicate toast
  - each failure kind's UI
  - the countdown re-enables Send
  - the Cancel button aborts
  - the existing 401 tests still pass on the new URL
- **`NewBillReview`.**
  - confirm payload and endpoint
  - create mode endpoint, and Save disabled until every line has a category
  - `hid` mismatch disables Save
  - 400 messages, 404, 409 and 403 handling
  - Cancel sends `DELETE`
- **Existing hooks and pages** (`useMarkets`, `useSubCategories`, `useConfirmedBills`, `useBillDetail`, `ConfirmedBills`, `BillDetailDrawer`): update the mocks to `/households/{hid}/…` and wrap renders in a test `HouseholdProvider`, using a shared helper in `src/test/`.
- **Final check:** `npm run lint`, `npm run test:run`, `npm run build`.

## 6. Future work (out of scope)

- A household switcher in the header, and `hid` in the route (`/h/{hid}/…`)
- Create, rename and delete a household, seeding default categories, the role from `GET /households/{hid}`
- Invites and the `/invite/:token` route, leaving a household and removing members
- A pending-drafts list or badge (`GET /bills/drafts`), and resuming drafts
- Showing the server photo from `GET /bills/drafts/{id}/image` on the review page
- Downscaling photos in the browser before upload (`prepareReceiptPhoto`)
- Picking an existing market (`market_id`) on the review page
- Backend: `exposedHeaders: ['Retry-After']` in CORS, and `new_market` on `CreateBillDto`
