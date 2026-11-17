# HAN-26 Страница «Бюджеты» и переключатель — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Страница `/households` «Budgets» (создать, править, своё имя, удалить), переключатель активного бюджета в шапке, ссылки на чек с `?hid=` и «Budget» вместо «Household» в UI.

**Architecture:** API и мутации бюджетов — в `src/api/households.ts` и хуках `src/hooks/use*Household*.ts`, кеш списка `['households']` правится слиянием полей. Переключатель — `DropdownMenu` поверх `HouseholdContext`. `?hid=` разбирает `BillDetailRoute` до рендера карточки; ссылки строит `billPath`. Страница — набор компонентов в `src/pages/households/`.

**Tech Stack:** React 19, TypeScript (`exactOptionalPropertyTypes`), react-query 5, react-router-dom 7, react-hook-form + zod, i18next (`en`), Vitest + Testing Library + user-event, `vi.mock` для API (как в существующих тестах).

**Spec:** `docs/superpowers/specs/2026-11-17-han-26-budgets-page-switcher-design.md` (документ «Spec: HAN-26» в Linear).

## Global Constraints

- В видимых `en`-строках «Budget»/«Budgets» вместо «Household»; ключи i18n, код, типы, пути API (`household`, `hid`) не переименовываются. Новые строки — namespace `households`.
- Лимит бюджетов на фронте — константа `MAX_HOUSEHOLDS = 5` в `src/const/households.ts`.
- 409 различаются по `reason` из тела ответа: `household_limit`, `last_household`, `household_has_members`.
- Все мутации бюджетов — `meta: OWN_FORBIDDEN_META`.
- Компоненты — только из `src/components/ui` и `src/components/common` (`ConfirmDialog`, `LoadingFallback`, `CurrencySelect`); новых примитивов и зависимостей нет.
- Новый бюджет не становится активным автоматически.
- `role` в списке приходит с сервера (HAN-146); тип делает его обязательным.
- Ветка `enh/han-26-budgets-switcher`; коммиты с `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; перед каждым коммитом `npx vitest run <тесты задачи>` и `npx eslint <файлы>`; в конце `npm run verify`.

## Review Focus

1. Ссылка `?hid=` на бюджет, которого нет в списке и после `refetch()` (удалён, нет доступа), — экран «can't access», запрос чека **не** уходит. → тест в Task 5.
2. Ручное переключение бюджета сразу после перехода по ссылке `?hid=` — бюджет из ссылки не возвращается (параметр уже убран из адреса). → тест в Task 5.
3. Удаление **активного** бюджета — активным становится первый оставшийся, запросы удалённого `hid` убраны из кеша, нет тоста «access lost». → тест в Task 2 (кеш) и Task 7 (страница).
4. Смена имени владельцем, у которого задано своё имя (`name !== original_name`): форма заполнена из `original_name`, после сохранения видимое `name` не затирается основным. → тест в Task 2 (слияние) и Task 7.
5. Создание бюджета и сразу «Switch to it» в тосте до завершения refetch — переключение срабатывает (строка уже в кеше). → тест в Task 2 и Task 6.

---

### Task 1: Типы, API, причины ошибок, фикстуры

**Files:**
- Modify: `src/types/households.ts`, `src/api/households.ts`, `src/const/households.ts`, `src/test/household.tsx`
- Create: `src/lib/householdErrorReason.ts`, `src/lib/householdErrorReason.test.ts`, `src/api/households.test.ts`

**Interfaces:**
- Produces:
  - `interface HouseholdResponse { id: string; name: string; original_name: string; currency: Currency; created_at: string; member_count: number; role?: 'owner' | 'member' }` — ответ `POST`/`PUT`.
  - `interface Household extends HouseholdResponse { role: 'owner' | 'member'; bill_count: number }` — строка списка.
  - `interface CreateHouseholdRequest { name: string; currency: Currency }`; `interface UpdateMyHouseholdRequest { display_name: string | null }`; `UpdateHouseholdRequest` без изменений.
  - `householdsApi.create(body: CreateHouseholdRequest): Promise<HouseholdResponse>` (`POST /households`), `update(hid, body): Promise<HouseholdResponse>`, `updateMine(hid, body: UpdateMyHouseholdRequest): Promise<HouseholdResponse>` (`PUT householdPath(hid, '/me')`), `remove(hid): Promise<void>` (`DELETE householdPath(hid)`). `list` возвращает порядок ответа без сортировки.
  - `MAX_HOUSEHOLDS = 5` в `src/const/households.ts`.
  - `type HouseholdErrorReason = 'household_limit' | 'last_household' | 'household_has_members'`; `householdErrorReason(err: unknown): HouseholdErrorReason | null` — `ApiError` со `status === 409` и `body.reason` из списка, иначе `null`.
  - Фикстуры `TEST_HOUSEHOLDS` дополнены `original_name` (= `name`) и `bill_count` (`hh-1`: 12, `hh-2`: 0).

- [ ] **Step 1: Тесты.** `householdErrorReason.test.ts`: `returns the reason of a 409` (`new ApiError(409, { reason: 'last_household' })` → `'last_household'`); `ignores unknown reasons` (`reason: 'other'` → `null`); `ignores other statuses` (`ApiError(400, { reason: 'household_limit' })` → `null`); `ignores non-ApiError` (`new Error()` → `null`). `households.test.ts` (мок `apiClient`): `list keeps server order` (ответ `[b, a]` с `created_at` по возрастанию в обратном порядке → тот же порядок); `create posts to /households`; `updateMine puts to /households/hh-1/me with display_name null`; `remove deletes /households/hh-1`.
- [ ] **Step 2:** `npx vitest run src/lib/householdErrorReason.test.ts src/api/households.test.ts` → FAIL.
- [ ] **Step 3:** Реализовать по Interfaces; поправить фикстуры; `npx tsc -b` покажет места, где `Household` собирается без новых полей (тесты и `useUpdateHousehold`) — поправить фикстуры, хук — в Task 2 (до тех пор допустимо `as Household` в его тесте).
- [ ] **Step 4:** Тесты → PASS; `npx tsc -b` без ошибок.
- [ ] **Step 5:** Коммит `feat(households): household types, API and error reasons (HAN-26)`.

### Task 2: Мутации бюджетов и кеш списка

**Files:**
- Modify: `src/hooks/useUpdateHousehold.ts`, `src/hooks/useUpdateHousehold.test.tsx`
- Create: `src/hooks/useHouseholdMutations.ts` (create, updateMine, delete), `src/hooks/useHouseholdMutations.test.tsx`, `src/hooks/mergeHouseholdResponse.ts`

**Interfaces:**
- Consumes: Task 1 (`householdsApi`, `HouseholdResponse`, `Household`).
- Produces:
  - `mergeHouseholdResponse(list: Household[] | undefined, saved: HouseholdResponse): Household[] | undefined` — в строке с `saved.id` заменяет `name`, `original_name`, `currency`, `member_count` (и `role`, если пришёл), сохраняет `bill_count`; прочие строки — те же ссылки.
  - `useUpdateHousehold(hid)` — как сейчас, но кеш через `mergeHouseholdResponse`.
  - `useCreateHousehold(): UseMutationResult<HouseholdResponse, unknown, CreateHouseholdRequest>` — onSuccess: дописать `{ ...saved, role: 'owner', bill_count: 0 }` в конец `['households']`, затем `invalidateQueries({ queryKey: ['households'], exact: true })`.
  - `useUpdateMyHouseholdName(hid): UseMutationResult<HouseholdResponse, unknown, UpdateMyHouseholdRequest>` — кеш через `mergeHouseholdResponse`, без инвалидации данных бюджета.
  - `useDeleteHousehold(): UseMutationResult<void, unknown, string>` (переменная — `hid`) — onSuccess: убрать строку из `['households']`, `removeQueries({ queryKey: ['households', hid] })`.

- [ ] **Step 1: Тесты.** `useUpdateHousehold.test.tsx`: существующий тест переписать на `HouseholdResponse` без `bill_count`; добавить `keeps bill_count and the member's own name semantics` — ответ `{ ...hh1, currency: 'MDL' }` без `bill_count` → в кеше `bill_count` 12, `currency` MDL. `useHouseholdMutations.test.tsx`: `create appends the new household as owner with zero bills before refetch` (кеш содержит новую строку сразу после `mutateAsync`, `role: 'owner'`, `bill_count: 0`; список помечен invalidated); `updateMine merges the new name` (`name: 'Mine'`, `original_name` прежнее, ключ `['households','hh-2','bills']` **не** invalidated); `delete removes the row and the household queries` (кеш без `hh-1`, `getQueryState(['households','hh-1','bills'])` → `undefined`, `['households','hh-2','bills']` на месте); все мутации имеют `options.meta.ownForbidden === true` (через `client.getMutationCache().getAll()`).
- [ ] **Step 2:** `npx vitest run src/hooks/useUpdateHousehold.test.tsx src/hooks/useHouseholdMutations.test.tsx` → FAIL.
- [ ] **Step 3:** Реализовать по Interfaces.
- [ ] **Step 4:** Тесты → PASS.
- [ ] **Step 5:** Коммит `feat(households): create, rename-for-me and delete mutations (HAN-26)`.

### Task 3: «Budget» в текстах

**Files:**
- Modify: `src/i18n/locales/en/households.json`, `header.json`, `bills.json`, `dashboard.json` (только если в значениях есть «household»), тесты, ищущие старые тексты (`grep -rn "Household" src --include=*.test.tsx`).
- Create: `src/i18n/locales/en/noHouseholdWording.test.ts`

**Interfaces:**
- Produces: ключ `header:menu.budgets` = `"Budgets"` (вместо `menu.householdSettings`, который удаляется в Task 8); `households:accessLost` = `"You no longer have access to this budget."`, `households:loadFailed` = `"Could not load your budgets."`; `bills:newBillModal.household` = `"Budget"`, `noHousehold`, `review.otherHousehold*` — с «budget».

- [ ] **Step 1: Тест** `noHouseholdWording.test.ts`: импортирует все `en/*.json`, рекурсивно обходит значения, `expect(offending).toEqual([])`, где `offending` — пути значений, содержащих `/household/i`.
- [ ] **Step 2:** `npx vitest run src/i18n` → FAIL со списком путей.
- [ ] **Step 3:** Заменить тексты; добавить `header:menu.budgets`; поправить тесты, ищущие старые тексты.
- [ ] **Step 4:** `npx vitest run` (весь набор — тексты используются повсюду) → PASS.
- [ ] **Step 5:** Коммит `feat(i18n): call households budgets in the UI (HAN-26)`.

### Task 4: Переключатель в шапке

**Files:**
- Create: `src/components/header/HouseholdSwitcher.tsx`, `src/components/header/HouseholdSwitcher.test.tsx`, `src/lib/billDetailParent.ts` (+ тест)
- Modify: `src/components/Header.tsx`, `src/components/header/MobileNav.tsx` (+ тест, если есть), `src/i18n/locales/en/households.json`

**Interfaces:**
- Consumes: `useHouseholds()` (`status`, `households`, `activeHousehold`, `setActiveHouseholdId`).
- Produces:
  - `billDetailParent(pathname: string): string | null` — для `/bills/:id`, `/bills/confirmed/:id`, `/bills/drafts/:id` возвращает `/bills`, `/bills/confirmed`, `/bills/drafts`; для `/bills/confirmed`, `/bills/review`, `/bills/duplicates`, прочих — `null`.
  - `HouseholdSwitcher(): ReactElement | null` — `null`, пока `status !== 'ready'`. Триггер: иконка `Wallet` + имя (`hidden md:inline`, `max-w-[10rem] truncate`) + `ChevronDown`; `aria-label` = `t('households:switcher.label', { name })` («Budget: {{name}}»). Меню: `DropdownMenuLabel` «Budgets», `DropdownMenuRadioGroup value={activeId}` с `DropdownMenuRadioItem` на бюджет (имя + валюта `text-xs text-muted-foreground`), разделитель, пункт-ссылка «Manage budgets» → `/households`.
  - Выбор: `setActiveHouseholdId(id)`; если `billDetailParent(location.pathname)` не `null` — `navigate({ pathname: parent, search: <search без hid> })`.
  - `Header`: `<HouseholdSwitcher />` перед `<BatchBell />`. `MobileNav`: под `SheetHeader` ссылка на `/households` с текстом `t('households:switcher.label', { name })`, закрывает меню.

- [ ] **Step 1: Тесты.** `billDetailParent.test.ts` — таблица случаев выше. `HouseholdSwitcher.test.tsx` (`HouseholdTestProvider` + `MemoryRouter`): `shows the active budget name`; `lists budgets with the active one checked` (`menuitemradio` `Personal` `aria-checked=true`); `selecting a budget calls setActiveHouseholdId` (`hh-2`); `on a bill page goes to its list keeping filters` (начальный путь `/bills/confirmed/b1?from=2026-01-01&hid=hh-1` → после выбора путь `/bills/confirmed`, `search` `?from=2026-01-01`); `stays on other pages` (`/dashboard` остаётся); `Manage budgets links to /households`; `renders nothing while loading` (`status: 'loading'`). `MobileNav`: `shows the active budget`.
- [ ] **Step 2:** `npx vitest run src/components/header src/lib/billDetailParent.test.ts` → FAIL.
- [ ] **Step 3:** Реализовать по Interfaces.
- [ ] **Step 4:** Тесты → PASS.
- [ ] **Step 5:** Коммит `feat(header): active budget switcher (HAN-26)`.

### Task 5: Ссылки на чек с `?hid=`

**Files:**
- Create: `src/lib/billPath.ts` (+ тест), `src/pages/bills/useBillLinkHousehold.ts`
- Modify: `src/pages/bills/BillDetailRoute.tsx`, `BillDetailRoute.test.tsx`, `src/components/header/BatchItemRow.tsx`, `src/pages/bills/NewBillReview.tsx`, `src/pages/bills/components/FailedBillCard.tsx`, `DuplicatePairCard.tsx`, `DuplicateOfBadge.tsx`, `src/pages/bills/BillsListPage.tsx`, `DraftBills.tsx`, `src/i18n/locales/en/households.json`

**Interfaces:**
- Consumes: `useHouseholds()` (`status`, `households`, `activeHousehold`, `setActiveHouseholdId`, `refetch`), `toast`.
- Produces:
  - `type BillSection = 'all' | 'confirmed' | 'drafts'`; `billPath(section: BillSection, id: string, hid: string, search?: string): string` → `/bills/:id`, `/bills/confirmed/:id`, `/bills/drafts/:id`; `hid` добавляется в `search` (существующие параметры сохраняются, `hid` заменяется).
  - `useBillLinkHousehold(): 'ready' | 'pending' | 'inaccessible'`:
    - нет `hid` в query или совпадает с активным → `'ready'` (совпадающий `hid` тоже убрать из адреса);
    - `status !== 'ready'` → `'pending'`;
    - `hid` есть в `households` → `setActiveHouseholdId(hid)`, тост `households:switchedTo` («Switched to budget {{name}}»), убрать `hid` из адреса (`navigate({ search }, { replace: true })`), `'pending'` до совпадения активного;
    - нет в списке → один `refetch()` (флаг в `useRef` на значение `hid`), `'pending'`; после refetch всё ещё нет → `'inaccessible'`.
  - `BillDetailRoute`: `'pending'` → `LoadingFallback`; `'inaccessible'` → текст `households:billInaccessible` («This bill is in a budget you can't access.») и ссылка на список; `'ready'` → как сейчас.
  - Ссылки: `BatchItemRow` — `billPath('drafts', item.bill_id, batch.hid)`; `NewBillReview` после сохранения — `billPath('confirmed', saved.id, savedHid)`; `FailedBillCard`, `DuplicatePairCard`, `DuplicateOfBadge`, `BillsListPage`, `DraftBills` — с активным `hid` (у относительных путей `pathname` прежний, `search` через `billPath`-логику: вынести `withHid(search: string, hid: string): string` в `billPath.ts` и использовать его).
  - `NewBillReview` (черновик другого бюджета): кнопка `households:switchTo` («Switch to {{name}}») → `setActiveHouseholdId(hid)`; не показывается, если бюджет неизвестен.

- [ ] **Step 1: Тесты.** `billPath.test.ts`: три раздела; `keeps other params and replaces hid` (`'?from=x&hid=old'` → `?from=x&hid=new`). `BillDetailRoute.test.tsx` (мок `useBillDetail` уже есть — сохранить): `switches to the budget from the link and drops hid` (активный `hh-1`, путь `/bills/b1?hid=hh-2` → `setActiveHouseholdId('hh-2')`, тост с «Family Budget», `location.search` пуст); `does not switch back after a manual switch` (после шага выше перерендер с активным `hh-1` — `setActiveHouseholdId` вызван 1 раз); `refetches once for an unknown budget, then shows inaccessible` (`refetch` вызван 1 раз, текст «can't access», `useBillDetail` вызван с `enabled`-false / `billsApi.detail` не вызван); `unknown budget found after refetch switches` (`refetch` подменяет `households`); `matching hid renders the bill`; `waits while households load`. `BatchItemRow`: ссылка содержит `?hid=<hid пачки>`. `NewBillReview`: `offers to switch to the draft's budget`.
- [ ] **Step 2:** `npx vitest run src/lib/billPath.test.ts src/pages/bills src/components/header/BatchBell.test.tsx` → FAIL.
- [ ] **Step 3:** Реализовать по Interfaces.
- [ ] **Step 4:** Тесты → PASS.
- [ ] **Step 5:** Коммит `feat(bills): budget in bill links with auto-switch (HAN-26)`.

### Task 6: Страница «Budgets»: список и создание

**Files:**
- Create: `src/pages/households/HouseholdsPage.tsx`, `HouseholdCard.tsx`, `CreateHouseholdDialog.tsx`, `HouseholdsPage.test.tsx`, `CreateHouseholdDialog.test.tsx`
- Modify: `src/lib/validation-schemas.ts` (`householdNameSchema` — `z.string().trim().min(1).max(MAX_NAME_LENGTH)`; `createHouseholdSchema = { name, currency }`), `src/i18n/locales/en/households.json`

**Interfaces:**
- Consumes: `useHouseholds()`, `useCreateHousehold()` (Task 2), `householdErrorReason` (Task 1), `MAX_HOUSEHOLDS`.
- Produces:
  - `HouseholdsPage(): ReactElement` — `idle/loading` → `LoadingFallback`; `error` → «Could not load your budgets» + «Try again» (`refetch`); `empty` → «You have no budgets» + кнопка создания; `ready` → заголовок «Budgets», кнопка «New budget» (`disabled` при `households.length >= MAX_HOUSEHOLDS`, рядом `households:limitReached` «You can have up to 5 budgets»), список `HouseholdCard` в порядке `households`.
  - `HouseholdCard({ household, active }: { household: Household; active: boolean }): ReactElement` — `<article aria-labelledby>` с именем; `original_name` мелко, если `!== name`; валюта; бейдж «Owner»/«Member»; `t('households:billCount', { count })` («{{count}} bill(s)» через plural); бейдж «Active» при `active`; кнопка «Make active» (`setActiveHouseholdId`) при `!active`; кнопка «Edit», раскрывающая слот формы (Task 7 подставляет `HouseholdEditor`; в этой задаче — заглушка не нужна: кнопки «Edit» ещё нет).
  - `CreateHouseholdDialog({ open, onOpenChange, defaultCurrency }): ReactElement` — `Dialog` + форма `createHouseholdSchema`, `CurrencySelect` с `defaultCurrency` (= валюта активного; при отсутствии — `'EUR'`). Успех: закрыть, тост «Budget created» с действием «Switch to it» (`setActiveHouseholdId(saved.id)`). `household_limit` → текст в окне «You already have 5 budgets»; прочие ошибки → тост «Couldn't create the budget».

- [ ] **Step 1: Тесты.** `HouseholdsPage.test.tsx` (`HouseholdTestProvider`, мок хуков мутаций): `lists budgets with currency, role, bill count and active badge` (`Personal` — Owner, EUR, «12 bills», Active; `Family Budget` — Member, MDL, «0 bills»); `shows the original name when the own name differs`; `make active switches` (`hh-2`); `new budget is disabled at the limit` (5 бюджетов в контексте); `loading`, `error with retry`, `empty`. `CreateHouseholdDialog.test.tsx`: `creates with trimmed name and the active currency` (`'  Trip '` → `{ name: 'Trip', currency: 'EUR' }`); `requires a name`; `shows the limit message on 409 household_limit` (окно не закрыто); `toast offers switching to the new budget` (действие тоста вызывает `setActiveHouseholdId` с id ответа).
- [ ] **Step 2:** `npx vitest run src/pages/households` → FAIL.
- [ ] **Step 3:** Реализовать по Interfaces.
- [ ] **Step 4:** Тесты → PASS.
- [ ] **Step 5:** Коммит `feat(households): budgets page with create (HAN-26)`.

### Task 7: Правка, своё имя и удаление в карточке

**Files:**
- Create: `src/pages/households/HouseholdEditor.tsx`, `OwnNameForm.tsx`, `DeleteHouseholdButton.tsx`, `HouseholdEditor.test.tsx`, `DeleteHouseholdButton.test.tsx`
- Modify: `HouseholdCard.tsx` (кнопка «Edit» раскрывает `HouseholdEditor`), `changedFields.ts` (+ тест: сравнивает с `original_name`), `src/i18n/locales/en/households.json`

**Interfaces:**
- Consumes: `useUpdateHousehold`, `useUpdateMyHouseholdName`, `useDeleteHousehold` (Task 2); `householdErrorReason` (Task 1); `ConfirmDialog`.
- Produces:
  - `changedFields(initial: Household, values)` — имя сравнивается с `initial.original_name`.
  - `HouseholdEditor({ household }: { household: Household }): ReactElement` — owner: форма основного имени (`defaultValues.name = original_name`) и валюты (подсказка о пересчёте), «Save» `disabled` без изменений, отправляет `changedFields`; member: имя (`original_name`) и валюта текстом + «Only the owner can change name and currency». Ниже у всех — `OwnNameForm`; у owner — `DeleteHouseholdButton`. 403 при сохранении → режим только чтения (как сейчас в `HouseholdSettings`); 400 → «Couldn't save — check the values»; прочее → тост.
  - `OwnNameForm({ household })` — поле «Your name for this budget» (`defaultValues` = `name !== original_name ? name : ''`), «Save» → `updateMine({ display_name: trimmed })`, пустое → ошибка валидации; «Reset» (виден, если `name !== original_name`) → `updateMine({ display_name: null })`.
  - `DeleteHouseholdButton({ household }: { household: Household })` — `disabled` с подсказкой (`Tooltip`) при `households.length === 1` («You can't delete your only budget») или `member_count > 1` («Remove other members first»). `ConfirmDialog` destructive: заголовок `Delete “{{name}}”?`, описание `households:delete.withBills` («It has {{count}} bill(s). This can't be undone.») или `households:delete.noBills` («This can't be undone.»). Успех — тост «Budget deleted». Ошибки: `last_household` → «You can't delete your only budget»; `household_has_members` → «Remove other members first»; 403 → «Only the owner can delete this budget»; прочее → «Couldn't delete the budget».

- [ ] **Step 1: Тесты.** `changedFields.test.ts`: `compares the name with original_name` (`name: 'Mine'`, `original_name: 'Family'`, значения `{ name: 'Family' }` → `{}`). `HouseholdEditor.test.tsx`: `owner form starts from original_name`; `owner saves only changed fields` (`{ currency: 'MDL' }`); `member sees read-only name and currency, no Save, no Delete`; `403 on save switches to read-only`; `own name: save trims`, `own name: empty is rejected`, `own name: reset sends null` (кнопка видна только при своём имени); `owner also gets the own name form`. `DeleteHouseholdButton.test.tsx`: `confirmation mentions the bill count` (12) и `omits it at zero`; `disabled for the only budget`; `disabled with other members` (`member_count: 3`); `409 last_household / household_has_members show their texts`; `deleting calls the mutation with the hid`.
- [ ] **Step 2:** `npx vitest run src/pages/households` → FAIL.
- [ ] **Step 3:** Реализовать по Interfaces.
- [ ] **Step 4:** Тесты → PASS.
- [ ] **Step 5:** Коммит `feat(households): edit, own name and delete a budget (HAN-26)`.

### Task 8: Маршруты, меню, проверка переключения, финальная проверка

**Files:**
- Modify: `src/App.tsx`, `src/App.test.tsx`, `src/components/header/UserMenu.tsx`, `UserMenu.test.tsx`, `src/i18n/locales/en/header.json` (удалить `menu.householdSettings`), `households.json` (удалить неиспользуемые `settings.*`)
- Delete: `src/pages/households/HouseholdSettings.tsx`, `HouseholdSettings.test.tsx`
- Create: `src/pages/households/switchingIsolation.test.tsx`

**Interfaces:**
- Consumes: `HouseholdsPage` (Task 6), `HouseholdSwitcher` (Task 4).
- Produces: маршрут `/households` (`RequireAuth` + lazy `HouseholdsPage`, как соседние); `/households/settings` → `<Navigate to="/households" replace />`; пункт `UserMenu` «Budgets» → `/households` (иконка `Wallet`).

- [ ] **Step 1: Тесты.** `App.test.tsx`: `/households/settings redirects to /households`. `UserMenu.test.tsx`: пункт «Budgets» ведёт на `/households`. `switchingIsolation.test.tsx`: реальный `HouseholdProvider` + `QueryClient`, мок `householdsApi.list` (два бюджета) и `billsApi` (ответ зависит от `hid`: `hh-1` → чек «Alpha», `hh-2` → «Beta»); рендер `ConfirmedBills` + `HouseholdSwitcher`; выбрать `Family Budget` → «Alpha» исчезает и не появляется до «Beta» (`queryByText('Alpha')` → `null` сразу после выбора), затем «Beta»; `localStorage.activeHouseholdId === 'hh-2'`.
- [ ] **Step 2:** `npx vitest run src/App.test.tsx src/components/header src/pages/households` → FAIL.
- [ ] **Step 3:** Реализовать; удалить `HouseholdSettings*`; `npm run knip` укажет неиспользуемые строки/экспорты — убрать.
- [ ] **Step 4:** `npm run verify` → без ошибок.
- [ ] **Step 5:** Коммит `feat(households): budgets route replaces household settings (HAN-26)`.
- [ ] **Step 6:** Ручная проверка в браузере (dev-сервер против server dev с HAN-146): переключение в шапке на десктопе и мобильной ширине, создание, удаление активного, ссылка из колокольчика на черновик другого бюджета.
