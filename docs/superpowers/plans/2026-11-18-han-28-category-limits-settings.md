# HAN-28 Category Limits Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Page `/households/:id/limits` where any member sets, changes and removes a per-category spending limit (amount + calendar period) and sees, before saving, from which period the change applies.

**Architecture:** Pure helpers (period math, hint, row building) under `src/lib` and `src/pages/households/limits`, a thin axios client in `src/api`, React Query hooks in `src/hooks`, and a page of rows where one row at a time turns into an inline react-hook-form form. Server responses go straight into the query cache; no optimistic updates.

**Tech Stack:** React 19, TypeScript, React Router, @tanstack/react-query 5, react-hook-form + zod 4, i18next, Vitest + Testing Library + axios-mock-adapter.

**Spec:** `docs/superpowers/specs/2026-11-18-han-28-category-limits-settings-design.md`

## Global Constraints

- Branch `enh/han-28-category-limits`; every commit message ends with `(HAN-28)` and the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.
- `period_type` values exactly: `MONTHLY`, `QUARTERLY`, `SEMI_ANNUAL`, `YEARLY`.
- Amount: number `> 0`, `≤ 1e12`, at most 2 decimals; comma accepted as decimal separator. Currency is never sent.
- "Today" is the **UTC** date (`YYYY-MM-DD`), same as the server's `todayIsoDate()`.
- Calendar boundaries: quarters start Jan/Apr/Jul/Oct, halves Jan/Jul; intervals are half-open `[start, end)`.
- POST when the category has no limit or its limit has `effective_to !== null`; PUT when `effective_to === null`.
- Copy lives in i18n namespace `limits` (`src/i18n/locales/en/limits.json`); the card button label in `households.json`. English only.
- `npm run verify` (type-check, lint, format, arch, dup, knip, tests) must pass at the end. Layer rules (dependency-cruiser): axios only in `src/api`, `components/ui` only from `lib`.

## Review Focus

- Comma input `"12,5"` saves `12.5`; `"12,555"` is rejected — Task 3 test.
- User east of UTC at 00:30 local on Dec 1 (still Nov 30 UTC): hint says November, matching what the server writes — Task 1 test (`todayUtcIsoDate` with a fake `Date`).
- Double click on «Save» must not send two POSTs (second would 409) — Task 6 test: button disabled while pending.
- Opening another row while a form has unsaved edits discards them without a request — Task 7 test.
- Direct link to `/households/<unknown id>/limits` and to a budget while the households list is still loading — Task 8 tests.

---

### Task 1: Period math

**Files:**
- Create: `src/lib/limitPeriods.ts`
- Test: `src/lib/limitPeriods.test.ts`

**Interfaces:**
- Produces:
  - `type LimitPeriodType = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'YEARLY'` and `LIMIT_PERIOD_TYPES: readonly LimitPeriodType[]` (in that order)
  - `limitPeriodStart(type: LimitPeriodType, isoDate: string): string`
  - `limitPeriodEnd(type: LimitPeriodType, isoDate: string): string` — first day of the next period
  - `periodStartsBetween(type: LimitPeriodType, fromIso: string, toIso: string): string[]` — starts of periods of `type` with `fromIso <= start <= toIso`
  - `todayUtcIsoDate(now?: Date): string`

- [ ] **Step 1: Write failing tests** — `describe('limitPeriodStart/End')` with `it.each` rows:
  - `MONTHLY '2026-01-31'` → start `2026-01-01`, end `2026-02-01`; `MONTHLY '2026-12-15'` → end `2027-01-01`; `MONTHLY '2028-02-29'` → end `2028-03-01`
  - `QUARTERLY '2026-11-18'` → `2026-10-01` / `2027-01-01`; `QUARTERLY '2026-04-01'` → `2026-04-01` / `2026-07-01`
  - `SEMI_ANNUAL '2026-06-30'` → `2026-01-01` / `2026-07-01`; `SEMI_ANNUAL '2026-07-01'` → `2026-07-01` / `2027-01-01`
  - `YEARLY '2026-11-18'` → `2026-01-01` / `2027-01-01`
  - `periodStartsBetween('MONTHLY', '2026-10-01', '2026-11-01')` → `['2026-10-01','2026-11-01']`; `('MONTHLY','2026-11-01','2026-10-01')` → `[]`
  - `todayUtcIsoDate(new Date('2026-11-30T23:30:00-01:00'))` → `'2026-12-01'`; `todayUtcIsoDate(new Date('2026-12-01T00:30:00+02:00'))` → `'2026-11-30'`
- [ ] **Step 2:** `npx vitest run src/lib/limitPeriods.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** with plain string/number arithmetic on `YYYY-MM-DD` (no `Date` local-time parsing); `todayUtcIsoDate` = `now.toISOString().slice(0, 10)`.
- [ ] **Step 4:** same command → PASS.
- [ ] **Step 5: Commit** `feat(limits): calendar period math (HAN-28)`.

### Task 2: Types, endpoints, API client

**Files:**
- Create: `src/types/categoryLimits.ts`, `src/const/categoryLimits.ts`, `src/api/categoryLimits.ts`
- Test: `src/api/categoryLimits.test.ts`

**Interfaces:**
- Consumes: `LimitPeriodType` (Task 1), `householdPath` (`src/const/households.ts`), `apiClient`.
- Produces:
  - `interface CategoryLimit { id: string; category_id: string; category_name: string; category_archived: boolean; period_type: LimitPeriodType; amount: number; currency: string; effective_from: string; effective_to: string | null }`
  - `interface CreateCategoryLimitRequest { category_id: string; period_type: LimitPeriodType; amount: number }`, `type UpdateCategoryLimitRequest = Omit<CreateCategoryLimitRequest, 'category_id'>`
  - `CATEGORY_LIMITS_ENDPOINTS = { LIST: '/category-limits', ONE: (categoryId: string) => \`/category-limits/${categoryId}\` }`
  - `categoryLimitsApi.list(hid): Promise<CategoryLimit[]>`, `.create(hid, body): Promise<CategoryLimit>`, `.update(hid, categoryId, body): Promise<CategoryLimit>`, `.remove(hid, categoryId): Promise<CategoryLimit>`

- [ ] **Step 1: Failing tests** (pattern of `src/api/categories.test.ts`, `MockAdapter(apiClient)`):
  - `list` GETs `/households/hh-1/category-limits`, returns the array.
  - `create` POSTs `{category_id:'c1', period_type:'MONTHLY', amount:400}` to `/households/hh-1/category-limits` (assert `JSON.parse(mock.history.post[0].data)`), returns 201 body.
  - `update` PUTs `{period_type:'QUARTERLY', amount:1000}` to `/households/hh-1/category-limits/c1`.
  - `remove` DELETEs `/households/hh-1/category-limits/c1`, returns body with `effective_to: '2026-12-01'`.
  - a 409 reply rejects with `ApiError` whose `status === 409`.
- [ ] **Step 2:** `npx vitest run src/api/categoryLimits.test.ts` → FAIL.
- [ ] **Step 3: Implement** the three files, mirroring `src/api/categories.ts`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(limits): category limits API client (HAN-28)`.

### Task 3: Form schema

**Files:**
- Modify: `src/lib/validation-schemas.ts` (append)
- Test: `src/lib/validation-schemas.test.ts` (create if absent, else append a `describe`)

**Interfaces:**
- Consumes: `LIMIT_PERIOD_TYPES` (Task 1).
- Produces: `categoryLimitSchema` — input `{ amount: string; period_type: LimitPeriodType }`, output `{ amount: number; period_type }`; `type CategoryLimitFormInput = z.input<…>`, `type CategoryLimitFormData = z.output<…>`; `MAX_LIMIT_AMOUNT = 1e12`.

- [ ] **Step 1: Failing tests** with `safeParse`:
  - `'400'` → `400`; `'12,5'` → `12.5`; `' 99.99 '` → `99.99`; `'1000000000000'` → ok.
  - rejected: `''`, `'0'`, `'-5'`, `'12,555'`, `'1000000000000.01'`, `'abc'`; error path `['amount']`, messages `'Enter an amount'` (empty), `'Amount must be greater than 0'`, `'At most 2 decimal places'`, `'Amount is too large'`, `'Enter a number'`.
  - `period_type: 'WEEKLY'` rejected.
- [ ] **Step 2:** `npx vitest run src/lib/validation-schemas.test.ts` → FAIL.
- [ ] **Step 3: Implement** — `z.string().trim()` → replace `,` with `.` → check `/^\d+(\.\d{1,2})?$/` (after empty / number checks, in the message order above) → `transform(Number)` → `> 0` and `≤ MAX_LIMIT_AMOUNT`; `period_type: z.enum(LIMIT_PERIOD_TYPES)`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(limits): limit form schema (HAN-28)`.

### Task 4: Query hooks

**Files:**
- Create: `src/hooks/useCategoryLimits.ts`
- Modify: `src/hooks/useCategoryTree.ts` — extract `useHouseholdCategories(hid: string | null)` returning the categories `useQuery` (same key `['households', hid, 'categories']`, same `staleTime`), and use it inside `useCategoryTree`.
- Test: `src/hooks/useCategoryLimits.test.tsx`

**Interfaces:**
- Consumes: `categoryLimitsApi`, `CategoryLimit`, request types (Task 2); `categoriesApi`.
- Produces:
  - `categoryLimitsKey(hid: string) => ['households', hid, 'category-limits'] as const`
  - `useHouseholdCategories(hid: string | null): UseQueryResult<CategoryResponse[]>`
  - `useCategoryLimitsQuery(hid: string): UseQueryResult<CategoryLimit[]>`
  - `useSaveCategoryLimit(hid: string): UseMutationResult<CategoryLimit, unknown, { categoryId: string; hasOpenLimit: boolean; body: UpdateCategoryLimitRequest }>` — `hasOpenLimit` → `update`, else `create({category_id, ...body})`
  - `useRemoveCategoryLimit(hid: string): UseMutationResult<CategoryLimit, unknown, string /* categoryId */>`
  - Both mutations `onSuccess(saved)`: `setQueryData(categoryLimitsKey(hid), list => replace or append by category_id)`, then `invalidateQueries({ queryKey: categoryLimitsKey(hid), refetchType: 'none' })`.

- [ ] **Step 1: Failing tests** (`QueryClientProvider` wrapper as in `useUpdateHousehold.test.tsx`, `vi.mock('@/api/categoryLimits')`):
  - save with `hasOpenLimit: false` calls `create('hh-1', {category_id:'c1', period_type:'MONTHLY', amount:400})`, not `update`.
  - save with `hasOpenLimit: true` calls `update('hh-1','c1',{period_type:'MONTHLY', amount:450})`.
  - after save, `queryClient.getQueryData(categoryLimitsKey('hh-1'))` contains the returned limit in place of the old one for `c1` (list length unchanged) and appends for a new category.
  - remove calls `remove('hh-1','c1')` and stores the returned limit (with `effective_to`).
  - `useCategoryTree` existing tests still pass.
- [ ] **Step 2:** `npx vitest run src/hooks/useCategoryLimits.test.tsx src/hooks/useCategoryTree.test.tsx` → new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(limits): category limits query hooks (HAN-28)`.

### Task 5: Rows and hint (pure)

**Files:**
- Create: `src/pages/households/limits/limitRows.ts`, `src/pages/households/limits/limitHint.ts`
- Test: `src/pages/households/limits/limitRows.test.ts`, `src/pages/households/limits/limitHint.test.ts`

**Interfaces:**
- Consumes: Task 1 functions, `CategoryLimit` (Task 2), `CategoryResponse`.
- Produces:
  - `type LimitRowState = 'none' | 'active' | 'ending' | 'archived'`
  - `interface LimitRowModel { categoryId: string; name: string; limit: CategoryLimit | null; state: LimitRowState; otherCurrency: boolean }`
  - `buildLimitRows(categories: CategoryResponse[], limits: CategoryLimit[], householdCurrency: string): LimitRowModel[]`
  - `interface LimitHint { start: string; lostPeriods: { type: LimitPeriodType; starts: string[] } | null }`
  - `limitHint(newType: LimitPeriodType, current: CategoryLimit | null, today: string): LimitHint` — `start = limitPeriodStart(newType, today)`; `lostPeriods` only when `current` is open (`effective_to === null`), `current.period_type !== newType` and `start < limitPeriodStart(current.period_type, today)`; then `starts = periodStartsBetween(current.period_type, start, limitPeriodStart(current.period_type, today))`.
  - `formatPeriod(type: LimitPeriodType, isoStart: string, lang: string): string` — `MONTHLY` → `Intl` `{month:'long', year:'numeric', timeZone:'UTC'}` ("November 2026"); `QUARTERLY` → `Q4 2026`; `SEMI_ANNUAL` → `H2 2026`; `YEARLY` → `2026`.

- [ ] **Step 1: Failing tests:**
  - rows: categories `Transport`, `Food`, `Rent`; limits Food open EUR, Rent `effective_to:'2026-12-01'`, plus `{category_id:'x', category_name:'Old', category_archived:true}` → order `Food(active)`, `Rent(ending)`, `Transport(none)`, `Old(archived)`; a limit in `USD` with household `EUR` → `otherCurrency: true`.
  - hint: `limitHint('QUARTERLY', openMonthly, '2026-11-18')` → `{start:'2026-10-01', lostPeriods:{type:'MONTHLY', starts:['2026-10-01','2026-11-01']}}`; `limitHint('MONTHLY', openQuarterly, '2026-11-18')` → `{start:'2026-11-01', lostPeriods:null}`; `limitHint('MONTHLY', null, '2026-11-18')` → start `2026-11-01`, null; same type → null; ending limit (`effective_to` set) → null.
  - `formatPeriod` four cases with `'en'`.
- [ ] **Step 2:** `npx vitest run src/pages/households/limits` → FAIL.
- [ ] **Step 3: Implement.** Within a group sort by `name.localeCompare(other, undefined, {sensitivity:'base'})`; groups `active|ending` (together, by name) → `none` → `archived`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(limits): limit rows and change hint (HAN-28)`.

### Task 6: Inline limit form

**Files:**
- Create: `src/pages/households/limits/LimitForm.tsx`, `src/i18n/locales/en/limits.json`
- Modify: `src/i18n/index.ts` (register `limits` in `resources.en` and `ns`)
- Test: `src/pages/households/limits/LimitForm.test.tsx`

**Interfaces:**
- Consumes: `categoryLimitSchema` (Task 3), `useSaveCategoryLimit`, `categoryLimitsKey`, `useHouseholdCategories` key (Task 4), `limitHint`, `formatPeriod` (Task 5), `todayUtcIsoDate` (Task 1), `ApiError`, `Select`, `Input`, `Button`, `Form`, `toast`.
- Produces: `LimitForm({ hid, categoryId, categoryName, current, currency, onDone }: { hid: string; categoryId: string; categoryName: string; current: CategoryLimit | null; currency: string; onDone: (saved: boolean) => void }): ReactElement`
  - defaults: `current` open → its amount/type; otherwise `amount: ''`, `period_type: 'MONTHLY'`.
  - `hasOpenLimit = current?.effective_to === null`.
  - Save disabled when (`hasOpenLimit` and form not dirty) or mutation pending.
  - Hint `<p aria-live="polite">`: `limits:hint.from` = "Applies from {{period}}. Past periods don't change." + when `lostPeriods`: `limits:hint.lost` = "{{periods}} as months/quarters/halves stay without a limit" (periods joined with " and " for 2, "from {{first}} to {{last}}" for more).
  - Errors: 409 → inline `limits:errors.exists` "This category already has a limit — the list was refreshed", invalidate limits, keep form; 404 → toast `limits:errors.gone` "The category was deleted or the limit no longer exists — the list was refreshed", invalidate limits + categories, `onDone(false)`; 400 → `ApiError.messages[0]` under amount; other → toast `errors` generic (as `HouseholdEditor`).
  - Enter submits (native form), Esc → `onDone(false)`; success → `onDone(true)`.

- [ ] **Step 1: Failing tests** (`vi.mock('@/hooks/useCategoryLimits')`, `vi.useFakeTimers({ toFake: ['Date'] })` with `2026-11-18T10:00:00Z`):
  - new limit: hint shows "Applies from November 2026"; choosing "Quarter" changes it to "Q4 2026".
  - open monthly 300 → select Quarter → hint also mentions "October 2026 and November 2026".
  - Save disabled until amount changes for an open limit; enabled for a new one after typing `400`.
  - typing `400`, Save → `mutateAsync({categoryId:'c1', hasOpenLimit:false, body:{period_type:'MONTHLY', amount:400}})`; for an ending limit `hasOpenLimit:false`; for open → `true`.
  - pending mutation → Save disabled (double click sends one request).
  - rejected with `new ApiError(409, {})` → "already has a limit" text visible, form still there; `ApiError(404)` → `onDone(false)`.
  - Esc → `onDone(false)`.
- [ ] **Step 2:** `npx vitest run src/pages/households/limits/LimitForm.test.tsx` → FAIL.
- [ ] **Step 3: Implement** form and strings (`period.MONTHLY` "Month", `QUARTERLY` "Quarter", `SEMI_ANNUAL` "Half-year", `YEARLY` "Year"; `form.amount` "Amount", `form.save` "Save", `form.cancel` "Cancel").
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(limits): inline limit form with change hint (HAN-28)`.

### Task 7: Row and remove dialog

**Files:**
- Create: `src/pages/households/limits/LimitRow.tsx`, `src/pages/households/limits/RemoveLimitDialog.tsx`
- Modify: `src/i18n/locales/en/limits.json`
- Test: `src/pages/households/limits/LimitRow.test.tsx`

**Interfaces:**
- Consumes: `LimitRowModel` (Task 5), `LimitForm` (Task 6), `useRemoveCategoryLimit` (Task 4), `limitPeriodEnd`, `todayUtcIsoDate` (Task 1), `formatAmount` (`src/lib/format.ts`), `Dialog`.
- Produces:
  - `LimitRow({ hid, row, currency, editing, onEdit, onDone }: { hid: string; row: LimitRowModel; currency: string; editing: boolean; onEdit: () => void; onDone: () => void }): ReactElement`
  - `RemoveLimitDialog({ hid, limit, open, onOpenChange }: …)`.
  - Display per spec table: `none` → "No limit" + button "Set limit" (aria-label "Set limit for {{name}}"); `active` → "€400.00 / month" + "Edit limit for {{name}}" / "Remove limit for {{name}}" icon buttons; `ending` → "… · until December 1, 2026" + "Set limit"; `otherCurrency` → extra muted "Changing it will use {{currency}}"; `archived` → muted, badge "Archived", no buttons; `editing` → `LimitForm`.
  - Dialog text: "Remove the limit for “{{name}}”? It applies until {{date}}, then it is removed. This period's balance won't carry over." Date = `limitPeriodEnd(type, today)`; buttons "Cancel" / "Remove".

- [ ] **Step 1: Failing tests:**
  - each state renders its text and only its buttons (archived: no buttons).
  - "Edit limit for Food" calls `onEdit`; `editing` renders the amount input.
  - Remove → dialog mentions "December 1, 2026" (fake date 2026-11-18, MONTHLY) → "Remove" calls `mutateAsync('c1')`, dialog closes.
  - Review Focus: parent-style test — render two rows with a small wrapper holding `editingId`; type in row A, click "Set limit for B" → row A form gone, no `mutateAsync` call.
- [ ] **Step 2:** `npx vitest run src/pages/households/limits/LimitRow.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** Focus returns to the row's edit/set button after `onDone`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(limits): limit row and remove dialog (HAN-28)`.

### Task 8: Page, route, entry from the budget card

**Files:**
- Create: `src/pages/households/limits/CategoryLimitsPage.tsx`
- Modify: `src/App.tsx` (lazy route `/households/:id/limits`), `src/pages/households/HouseholdCard.tsx` (button "Limits" → `Link`), `src/i18n/locales/en/households.json` (`card.limits` "Limits", `card.limitsLabel` "Limits for {{name}}"), `src/i18n/locales/en/limits.json`
- Test: `src/pages/households/limits/CategoryLimitsPage.test.tsx`, extend `src/pages/households/HouseholdsPage.test.tsx`

**Interfaces:**
- Consumes: `useHouseholds` / `HouseholdTestProvider`, `useHouseholdCategories`, `useCategoryLimitsQuery` (Task 4), `buildLimitRows` (Task 5), `LimitRow` (Task 7), `LoadingFallback`.
- Produces: `CategoryLimitsPage(): ReactElement` — reads `:id` via `useParams`; holds `editingId: string | null`.
  - households `idle|loading` → `LoadingFallback`; id not in `households` → "Budget not found" + link "Back to budgets".
  - header: link "← Budgets" (`/households`), `<h1>{name} · Limits</h1>`, "Budget currency: {{currency}}".
  - queries pending → `LoadingFallback`; either errored → alert "Couldn't load limits" + "Retry" (refetch both).
  - no categories and no limits → "This budget has no categories".
  - list of `LimitRow`s.

- [ ] **Step 1: Failing tests** (`MemoryRouter initialEntries={['/households/hh-2/limits']}` + `Routes`, hooks mocked):
  - renders "Family Budget · Limits", "Budget currency: MDL", rows in `buildLimitRows` order.
  - unknown id → "Budget not found"; households `status:'loading'` → loading fallback, not "not found".
  - query error → "Couldn't load limits"; Retry calls both `refetch`.
  - empty → "This budget has no categories".
  - `HouseholdsPage.test.tsx`: card "Family Budget" has link "Limits for Family Budget" with `href="/households/hh-2/limits"` (wrap existing render in `MemoryRouter` if needed).
- [ ] **Step 2:** `npx vitest run src/pages/households` → new tests FAIL.
- [ ] **Step 3: Implement** page, route (lazy like `HouseholdsPage`, placed before `/households/settings`), card button.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(limits): limits page and entry from budget card (HAN-28)`.

### Task 9: Full verification

- [ ] **Step 1:** `npm run verify` → all checks green. Fix knip (unused exports), dup baseline, arch violations in the owning files rather than suppressing.
- [ ] **Step 2:** Run the app (dev server + local API on `dev`), open `/households`, click "Limits", set a monthly limit, change it to quarterly (hint mentions lost months), remove it (dialog date), check at 375px width. Screenshot.
- [ ] **Step 3: Commit** fixes, if any: `chore(limits): verify fixes (HAN-28)`.
