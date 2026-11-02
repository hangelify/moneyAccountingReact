# Shared Bill Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The review page, a draft opened from the Drafts tab, and a confirmed bill in Edit mode all edit through one form that can add and remove items, and the items-sum vs. total warning shows wherever they differ.

**Architecture:** A new `BillEditForm({ edits, onChange })` combines `BillReviewFields`, `BillTotalsBanner` and `BillItemsTable` over `BillEdits`. The detail flow (`useBillDetailActions`, `BillDetailPage`, `BillDetailDrawer`) drops the string-based `BillDetailDraft` for `BillEdits`, using pure helpers in `billDetailEdits.ts`. Confirm reuses `buildConfirmPayload`, and Save diffs against `billToEdits(bill)`.

**Tech Stack:** React 19, TypeScript, TanStack Query 5, react-i18next, Vitest + Testing Library + axios-mock-adapter.

**Spec:** `docs/superpowers/specs/2026-11-02-shared-bill-form-design.md`

## Global Constraints

- Mismatch tolerance stays `0.01` (`BillTotalsBanner`'s `TOLERANCE`).
- Amounts round to 2 decimals, weights to 3, `product_count` is `max(1, round(quantity))`, as in `buildConfirmPayload.ts`.
- `unit` and `price_per_kg` are never sent to the API.
- A cleared market or a cleared receipt field is never sent on update (PUT can't clear them).
- New strings go in `src/i18n/locales/en/bills.json` only (EN is the only locale).
- `docs/` is gitignored: commit plan and spec files with `git add -f`.
- Run `npm run type-check && npm run lint && npm run test:run` from the repo root before each commit; the pre-push hook runs the same.

## Review Focus

1. **Removing every item:** Confirm and Save must be disabled (`isEditsValid` requires ≥ 1 item). This is pinned in Task 1 and in the Task 3 page test.
2. **A newly added empty line (price 0):** it must block Confirm and Save instead of sending `amount: 0`. Pinned in Task 1 (`isEditsValid`).
3. **Reordering after removing the middle line:** the PUT must send the remaining lines with their own `id`s, not shifted ones. Pinned in Task 1 (`buildDetailUpdatePayload` remove-middle test).
4. **Switching between two drafts:** edits made on draft A must not show on draft B (the edits stay keyed by bill id). Pinned in the Task 3 page test.
5. **A saved bill whose items don't match its total, in read-only view:** the banner shows, and a matching bill shows none. Pinned in the Task 3 page test.

---

### Task 1: Pure detail-edits helpers

**Files:**
- Create: `src/pages/bills/billDetailEdits.ts`
- Create: `src/pages/bills/billDetailEdits.test.ts`
- Modify: `src/pages/bills/buildConfirmPayload.ts` (export `toConfirmItem`)

**Interfaces:**
- Consumes: `buildConfirmPayload`, `receiptFieldErrors`, `todayIso` from `./buildConfirmPayload`; `BillDetailResponseDto`, `BillEdits`, `ConfirmBillRequest`, `UpdateBillRequest` from `@/types/bills`.
- Produces:
  - `billToEdits(bill: BillDetailResponseDto): BillEdits`
  - `isEditsValid(edits: BillEdits): boolean`
  - `buildDetailConfirmPayload(bill: BillDetailResponseDto, edits: BillEdits, duplicateOfId?: string | null): ConfirmBillRequest`
  - `buildDetailUpdatePayload(bill: BillDetailResponseDto, edits: BillEdits): UpdateBillRequest`
  - `export function toConfirmItem(item: BillEditItem): ConfirmBillItem` (now exported from `buildConfirmPayload.ts`)

`billDetailDraft.ts` stays until Task 3 removes it.

- [ ] **Step 1: Write the failing tests** in `billDetailEdits.test.ts`, using the fixture from `billDetailDraft.test.ts` (market Lidl `m1`, lines `l1` MILK 2.49 sub `s1` no weight, `l2` APPLES 4.71 weight 0.942, total 7.2, currency EUR):
  - `billToEdits` maps `l2` to `{ id: 'l2', name: 'APPLES', quantity: 1, unit: 'kg', weight_kg: 0.942, price_per_kg: 5, final_price: 4.71, sub_category: null, category_confidence: 1 }`, and `l1` to `unit: 'piece', weight_kg: null, price_per_kg: null`; `bill_date` is sliced to 10 chars; `market_name` falls back to `market_name_raw`, then `''`; fiscal fields default to `''`.
  - `isEditsValid`: true for `billToEdits(bill)`; false for `items: []`, for any `final_price <= 0`, for `total_amount: 0`, for `bill_date: ''`, and for `purchase_time: '25:00'`.
  - `buildDetailConfirmPayload(bill, billToEdits(bill))` has `market_id: 'm1'` and no `new_market`; a renamed market sends `new_market: { name }` and no `market_id`; an empty market sends neither; it includes `currency: 'EUR'`, `items[0]` equals `{ id: 'l1', sub_category_id: 's1', raw_name: 'MILK', product_count: 1, amount: 2.49 }`, and `duplicate_of_id` appears only when given.
  - `buildDetailUpdatePayload`: unchanged → `{}`; `total_amount: 9` → `{ total_amount: 9 }`; `currency: 'USD'` → `{ currency: 'USD' }`; `fiscal_receipt_number: '42'` → `{ fiscal_receipt_number: '42' }`; a cleared market → `{}`; removing `l1` → `items` is exactly `[toConfirmItem(edits.items[0])]` with `id: 'l2'`; adding a line `{ name: 'BREAD', final_price: 1.5, … }` → `items` has 3 entries and the last has no `id`; a final price typed as `2.490` (same value) → `{}`.

- [ ] **Step 2: Run** `npx vitest run src/pages/bills/billDetailEdits.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `billDetailEdits.ts`. `buildDetailConfirmPayload` spreads `buildConfirmPayload(edits, todayIso(), duplicateOfId)`, removes its `new_market`, and adds the market from a local `marketFields(bill, name)` copied from `billDetailDraft.ts`. `buildDetailUpdatePayload` compares each scalar field against `billToEdits(bill)`, comparing totals after `round2`. It sends a receipt field only when it changed and isn't empty after trimming, and sends `items: edits.items.map(toConfirmItem)` when its JSON differs from the initial mapped list.

- [ ] **Step 4: Run** the same command. Expected: PASS. Then run `npx vitest run src/pages/bills/buildConfirmPayload.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/bills/billDetailEdits.ts src/pages/bills/billDetailEdits.test.ts src/pages/bills/buildConfirmPayload.ts
git commit -m "feat(bills): map bill details to review-form edits"
```

### Task 2: `BillEditForm`, used by the review page

**Files:**
- Create: `src/pages/bills/components/BillEditForm.tsx`
- Create: `src/pages/bills/components/BillEditForm.test.tsx`
- Modify: `src/pages/bills/NewBillReview.tsx` (replace the `BillReviewFields` + `BillTotalsBanner` + `BillItemsTable` block)

**Interfaces:**
- Produces: `BillEditForm(props: { edits: BillEdits; onChange: (edits: BillEdits) => void; marketHint?: string }): ReactElement`. It wraps its content in `TooltipProvider delayDuration={150}` so callers outside the review page get tooltips. Item update, add and remove are immutable updates that call `onChange` with the whole new `BillEdits`. A new item uses the same defaults as `billDraftStore.addItem` (`name: ''`, `quantity: 1`, `unit: 'piece'`, `weight_kg: null`, `price_per_kg: null`, `final_price: 0`, `sub_category: null`, `category_confidence: 1`). `onAddItem` returns the new index.

- [ ] **Step 1: Write the failing tests** in `BillEditForm.test.tsx` (render with `@/i18n` and a `QueryClientProvider` plus household provider as in `BillItemRow.test.tsx`, so `SubCategorySelect` can load). Wrap the form in a test harness that keeps `edits` in `useState`:
  - Deleting item 1 (first `Delete item` button, then confirm in the dialog) leaves one row: `findAllByTestId('item-final-price-0')[0]` has the value `4.71`.
  - `Add item` adds a row with `item-final-price-2`.
  - With items summing to 7.20 and `total_amount: 9`, the text `Items don't match the bill total` is shown; with `total_amount: 7.2` it isn't.

- [ ] **Step 2: Run** `npx vitest run src/pages/bills/components/BillEditForm.test.tsx`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `BillEditForm`** and switch `NewBillReview` to `<BillEditForm edits={edits} onChange={(next) => { setDirty(true); updateEdits(next); }} {...(createMode ? { marketHint } : {})} />`. Remove the page's now-unused `updateItem`/`removeItem`/`addItem` selectors and the `handleItemChange` helper, but keep them in the store.

- [ ] **Step 4: Run** `npx vitest run src/pages/bills/components/BillEditForm.test.tsx src/pages/bills/NewBillReview.test.tsx src/pages/bills/NewBillReview.strict.test.tsx`. Expected: all PASS, with the NewBillReview tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/pages/bills/components/BillEditForm.tsx src/pages/bills/components/BillEditForm.test.tsx src/pages/bills/NewBillReview.tsx
git commit -m "refactor(bills): extract the review form into BillEditForm"
```

### Task 3: Bill detail edits through `BillEditForm`

**Files:**
- Modify: `src/pages/bills/useBillDetailActions.ts`
- Modify: `src/pages/bills/BillDetailPage.tsx`, `src/pages/bills/BillDetailDrawer.tsx`
- Modify: `src/pages/bills/components/BillDetailTable.tsx` (read-only only: drop `draft`/`onDraftChange` and the edit branches)
- Modify: `src/pages/bills/components/BillDetailContent.tsx` (props `edits?: BillEdits | null`, `onEditsChange?`; the edit branch renders `BillEditForm`; delete `BillDetailEditForm`)
- Modify: `src/i18n/locales/en/bills.json` (add `confirmed.detail.reset: "Reset"`)
- Delete: `src/pages/bills/billDetailDraft.ts`, `src/pages/bills/billDetailDraft.test.ts`
- Test: `BillDetailPage.test.tsx`, `BillDetailDrawer.test.tsx`, `components/BillDetailContent.test.tsx`, `components/BillDetailTable.test.tsx`

**Interfaces:**
- Consumes: everything Task 1 produces; `BillEditForm` from Task 2; `BillTotalsBanner`.
- Produces: in `BillDetailActions`, `draft`/`setDraft` become `edits: BillEdits | null` / `setEdits: (edits: BillEdits) => void`, and `toggleEdit` keeps its name. The rest of the interface is unchanged.

**Behaviour to implement:**
- Local state `{ id, edits } | null`. Derived: `edits = local?.id === id ? local.edits : bill?.status === 'draft' ? billToEdits(bill) : null`. A draft is therefore always in the form, without an effect, and a different id never shows another bill's edits.
- `toggleEdit`: confirmed bill → `local = local ? null : { id, edits: billToEdits(bill) }`; draft → `local = null` (Reset). Successful save or confirm, and 409 → `local = null`.
- `canConfirm` and `canSave` use `isEditsValid(edits)` in place of `isDraftValid`. `canSave` still requires a non-empty `buildDetailUpdatePayload`. Confirm sends `buildDetailConfirmPayload(bill, edits ?? billToEdits(bill), pending)`.
- Header buttons (page and drawer): the Edit/Cancel button shows `Reset` for a draft (disabled when nothing changed locally, i.e. `local === null`), and `Edit`/`Cancel` for a confirmed bill. Confirm and Save stay as they are.
- Read-only view (page and drawer): above `BillDetailViews`, render `<BillTotalsBanner items={bill.items.map((i) => ({ final_price: i.amount }))} totalAmount={bill.total_amount} currency={bill.currency ?? ''} />`. In the form, the banner comes from `BillEditForm`.
- The description stays read-only above the form (`confirmed.table.description`).

- [ ] **Step 1: Rewrite the edit-mode tests** in `BillDetailPage.test.tsx` and `BillDetailDrawer.test.tsx` for the new form. The fields are `Market name`, `Total amount` and `Date` (label text); item prices are `findAllByTestId('item-final-price-N')[0]`. Item payloads now include `raw_name`. Cover:
  - A draft opens with `Market name` already editable (no Edit click), and the button reads `Reset`.
  - Draft: delete item 1 via `Delete item` and confirm in the dialog, then Confirm → `postedBody().items` equals `[{ id: 'l2', raw_name: 'APPLES', product_count: 1, amount: 4.71, product_weight: 0.942 }]`.
  - Draft: delete both items → `Confirm` and `Save` are disabled.
  - Confirmed: no `Market name` input until Edit; Edit → `Add item` → set price `1.5` → Save → `putBody().items` has 3 entries and the last has no `id`.
  - Confirmed bill with `total_amount: 9` in read-only view → `Items don't match the bill total` is shown; with `7.2` it isn't.
  - Draft d1 edited, then navigate to draft d2 → d2's `Market name` shows d2's market (use the existing "pending link does not carry over" test's two-draft setup).
  - Keep all duplicate, delete, 409/404/400 and chart-tab tests, updated to the new labels.
  - Remove the edit-mode cases from `BillDetailTable.test.tsx` (`renders inputs in edit mode…`, `footer sums the draft amounts…`) and from `BillDetailContent.test.tsx` (`renders market, date, total and item inputs…`, `lets the item sub-category be changed…`). Add one `BillDetailContent` test: given `edits`, it renders `Market name`.

- [ ] **Step 2: Run** `npx vitest run src/pages/bills`. Expected: the new and updated tests FAIL.

- [ ] **Step 3: Implement** the behaviour above, then delete `billDetailDraft.ts` and its test.

- [ ] **Step 4: Run** `npm run type-check && npm run lint && npm run test:run`. Expected: all green, and `grep -rn billDetailDraft src` prints nothing.

- [ ] **Step 5: Check it in the browser** on the dev server (desktop width, then a 375px width for the drawer). A draft opens in the form; deleting and adding items works; the warning appears when the total doesn't match.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "feat(bills): edit and confirm bills with the review form"
```
