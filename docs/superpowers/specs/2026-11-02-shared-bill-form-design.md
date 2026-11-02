# One Bill Form for Review, Confirm and Edit — Design

- **Date:** 2026-11-02
- **Branch:** `enh/shared-bill-form` (from `dev`)
- **Scope:** the editable form of a bill. The review page after Add new bill, a draft opened from the Drafts tab, and a confirmed bill in Edit mode all use the same form. Items can be added and removed everywhere. The items-sum vs. header-total warning shows whenever they differ, read-only views included.
- **Approach chosen:** one `BillEditForm` built on `BillEdits`. The detail flow drops `BillDetailDraft`.

---

## 1. Summary

The review page (`NewBillReview`) puts three components together: `BillReviewFields` (header fields), `BillTotalsBanner` (mismatch warning) and `BillItemsTable` (desktop rows and mobile cards, with add and delete). Its state is `BillEdits`, which holds numbers.

The bill detail (desktop `BillDetailPage`, mobile `BillDetailDrawer`) has its own editors: `BillDetailTable` in edit mode and `BillDetailEditForm` inside `BillDetailContent`. Their state is `BillDetailDraft`, which holds strings. They can change existing lines only. They can't add or remove a line, can't edit the name, currency or receipt fields, and show no mismatch warning.

After this change there is one model (`BillEdits`) and one form for all three flows.

## 2. Behaviour

| Where | Opens as | Actions |
|---|---|---|
| Review page (after Add new bill) | Form | Save, Cancel (unchanged) |
| Draft bill detail | **Form, right away** | Confirm, Save (PUT, changed fields only), Reset (back to loaded values), Delete |
| Confirmed bill detail | Read-only | Edit → form; then Save, Cancel. Delete |

- `BillTotalsBanner` shows in the form (live) and in the read-only view (saved values) whenever `|sum(items) − total| > 0.01`.
- The read-only view is otherwise unchanged: the `BillDetailTable` read mode on desktop and `BillDetailSummary` in the drawer, with the Items | Chart tabs. While the form is shown, the Chart tab is disabled, as it is in edit mode today.
- The description stays read-only and is shown above the form on the detail.
- When the bill is a draft, the form also shows the bill's duplicate section, as it does today.

## 3. Components

- **`BillEditForm`** (new, `src/pages/bills/components/BillEditForm.tsx`):
  `{ edits: BillEdits; onChange: (edits: BillEdits) => void; marketHint?: string }`.
  Renders `BillReviewFields`, `BillTotalsBanner` and `BillItemsTable`, and handles item update, add and remove as pure updates on `edits`. `onAddItem` returns the new index, which `BillItemsTable` needs to focus the new row.
- **`NewBillReview`** renders `BillEditForm` in place of the three components. The store keeps its own `updateItem`/`addItem`/`removeItem`, and the page sets `dirty` and writes the result through a single `updateEdits(next)`. Store tests stay as they are.
- **`BillDetailPage` / `BillDetailDrawer`**: when `edits !== null`, render `BillEditForm` (inside `BillDetailViews`, `editing`). Otherwise render the read-only view plus the banner. `BillDetailTable` and `BillDetailContent` lose their edit branches.
- **`useBillDetailActions`**: `draft: BillDetailDraft | null` becomes `edits: BillEdits | null` (and `setDraft` becomes `setEdits`). For a draft bill, edits are seeded from the loaded bill when it loads (and again on Reset, or when another bill id opens). For a confirmed bill they stay `null` until Edit is pressed and go back to `null` on Cancel or a successful Save. After a successful Confirm the bill is confirmed, so it shows read-only.

## 4. Data mapping (`src/pages/bills/billDetailEdits.ts`, replaces `billDetailDraft.ts`)

- `billToEdits(bill): BillEdits`
  - `market_name` = `bill.market?.name ?? bill.market_name_raw ?? ''`; `bill_date` = first 10 chars; `currency` = `bill.currency ?? ''`; `total_amount`; fiscal fields `?? ''`.
  - Item: `id`, `name = raw_name`, `quantity = product_count`, `final_price = amount`, `weight_kg = product_weight`, `unit = weight ? 'kg' : 'piece'`, `price_per_kg = weight ? round2(amount / weight) : null`, `sub_category`, `category_confidence = 1`.
- `isEditsValid(edits)`: date is `YYYY-MM-DD`, total > 0, at least one item, every `final_price` > 0, and `receiptFieldErrors(edits)` is empty.
- `buildDetailConfirmPayload(bill, edits, duplicateOfId)`: `buildConfirmPayload(edits, todayIso(), duplicateOfId)`, with the market resolved from the bill (`market_id` when the name is unchanged, `new_market` otherwise, nothing when empty).
- `buildDetailUpdatePayload(bill, edits)`: only the fields that differ from `billToEdits(bill)`, compared as sent: market, date, total (round2), currency, the three receipt fields, and `items` as the full list (existing lines with `id`, new lines without) when the sent list differs. That covers removals and reordering. A cleared market or cleared receipt field is left out, because the endpoint can't clear them.
- `unit` and `price_per_kg` only help with entry and are never sent, as on the review page.

## 5. Errors

No change. Confirm, save and delete keep the handling in `useBillDetailActions` (409, 404, 400 messages as a toast, 403 through the household provider). Invalid edits disable Confirm and Save, as `isDraftValid` does today.

## 6. Testing

- `billDetailEdits.test.ts`: the mapping, validity, and the update diff (unchanged → `{}`, removed item → items without it, added item → line without `id`, currency/receipt changes).
- `BillDetailPage.test.tsx` / `BillDetailDrawer.test.tsx`: a draft opens in the form; removing a line and confirming sends the reduced list; a confirmed bill stays read-only until Edit; Edit → remove → Save sends the PUT with the new items; the mismatch banner shows in the read-only view and in the form.
- `NewBillReview` tests keep passing unchanged (the same rendered form).
- Delete the edit-mode cases of `BillDetailContent.test.tsx` and `BillDetailTable.test.tsx` that no longer apply.

## 7. Out of scope

- Uploading or showing the receipt photo on the detail page.
- Requiring every line to be categorised on confirm (only create mode needs it, as today).
