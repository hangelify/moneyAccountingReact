# HAN-111 Table и SegmentedTabs — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Общие `Table*` и `SegmentedTabs`/`SegmentedNav` в `src/components/ui`, три таблицы чеков и два переключателя на них, без изменения вида.

**Architecture:** `table.tsx` — тонкие обёртки над `<table>`-элементами, плотность ячеек через React-контекст. `segmented-tabs.tsx` — `cva`-классы двух вариантов, кнопочный `tablist` с бродячим фокусом и стрелками, и `<nav>` из `NavLink`. Перенос мест — только замена разметки, логика компонентов не трогается.

**Tech Stack:** React 19, TypeScript, Tailwind, `cva` + `cn` (`@/lib/utils`), `react-router-dom` 7, Vitest + Testing Library + user-event.

**Spec:** `docs/superpowers/specs/2026-11-15-han-111-table-tabs-design.md` (и документ «Спека HAN-111» в задаче).

## Global Constraints

- Вид не меняется: итоговые классы элементов совпадают с нынешними (с точностью до `cn`/tailwind-merge и замены `border-t` строк на `border-b last:border-b-0`).
- Только токены цветов; без `dark:`; без новых зависимостей.
- Компоненты `ui` импортируют только `@/lib/*` и пакеты (ESLint + dependency-cruiser).
- Существующие тесты `ConfirmedBillsTable`, `BillDetailTable`, `BillDetailViews`, `BillsTabs`, `BillItemRow`, `BillItemsTable`/`BillEditForm` проходят **без правок**.
- Разделы витрины: `table` order 140, `segmented-tabs` order 150; без статичных `id` (раздел рендерится дважды).
- Ветка `enh/han-111-table-tabs`; коммиты с `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Выбранное значение не среди вкладок или выбранная вкладка `disabled` (Chart при правке до перерендера) — ровно одна вкладка с `tabIndex=0` (первая доступная), Tab попадает в список. → тест в Task 3.
2. Все вкладки, кроме выбранной, недоступны — стрелки ничего не делают и не падают. → тест в Task 3.
3. `BillItemRow` вне `Table` (его собственные тесты рендерят `<table><tbody>` вручную) — плотность по умолчанию, без ошибки контекста. → покрыто тем, что контекст имеет значение по умолчанию; тест в Task 1.
4. Стрелки внутри `BillDetailViews` при правке: Chart пропускается, фокус остаётся на Items. → тест в Task 4.
5. Два экземпляра `SegmentedTabs` на странице (витрина рендерит раздел дважды) — `id` не совпадают. → `DevUiPage.test` уже проверяет уникальность `id`; Task 5 прогоняет его.

---

### Task 1: `Table`

**Files:**
- Create: `src/components/ui/table.tsx`
- Test: `src/components/ui/table.test.tsx`

**Interfaces:**
- Produces:
  - `Table(props: TableHTMLAttributes<HTMLTableElement> & { density?: 'default' | 'compact'; containerClassName?: string })` — `<div className={cn('overflow-x-auto rounded-md border', containerClassName)}><table className={cn('w-full text-sm', className)} /></div>`; `forwardRef` на `<table>`.
  - `TableHeader` (`<thead>`, `border-b bg-muted/50 text-left`), `TableBody` (`<tbody>`), `TableFooter` (`<tfoot>`, `border-t bg-muted/30 font-medium`), `TableCaption` (`<caption>`, `mt-2 text-sm text-muted-foreground caption-bottom`).
  - `TableRow` (`<tr>`, `border-b last:border-b-0`). Граница под шапкой — на самом `<thead>` (`border-collapse` из preflight), а не на строке: у строки шапки её снял бы `last:border-b-0`.
  - `TableHead(props: ThHTMLAttributes & { numeric?: boolean })` — `font-medium` + плотность; `TableCell(props: TdHTMLAttributes & { numeric?: boolean })` — плотность.
  - Плотность: `default` → `px-3 py-2`, `compact` → `px-2 py-2`. `numeric` → `text-right tabular-nums`. Контекст по умолчанию `default`.
  - Все принимают `className` (через `cn`, последним) и пробрасывают остальные props.

- [ ] **Step 1: Тесты** в `table.test.tsx`:
  - `renders a scrollable bordered container`: `container.firstChild` имеет `overflow-x-auto rounded-md border`; `containerClassName="bg-card"` добавляется.
  - `cells use default density`: `TableCell` и `TableHead` внутри `<Table>` имеют `px-3 py-2`.
  - `compact density reaches cells`: `<Table density="compact">` → ячейка `px-2`, не `px-3`.
  - `numeric aligns right with tabular figures`: `TableCell numeric` → `text-right tabular-nums`; `TableHead numeric` тоже.
  - `className wins over base`: `<TableHead className="font-bold">` → `font-bold`, не `font-medium`; `<TableCell className="px-4">` → `px-4`, не `px-3`.
  - `cells work outside Table`: `render(<table><tbody><tr><TableCell>x</TableCell></tr></tbody></table>)` → `px-3`.
  - `renders footer and caption`: `getByRole('table')` содержит `tfoot` и `caption` с текстом.
- [ ] **Step 2:** `npx vitest run src/components/ui/table.test.tsx` → FAIL (модуля нет).
- [ ] **Step 3:** Реализовать `table.tsx` по Interfaces (`createContext<'default' | 'compact'>('default')`).
- [ ] **Step 4:** Тот же запуск → PASS; `npx eslint src/components/ui/table.tsx` → без ошибок.
- [ ] **Step 5:** Коммит `feat(ui): Table component`.

### Task 2: Таблицы чеков на `Table`

**Files:**
- Modify: `src/pages/bills/components/ConfirmedBillsTable.tsx`, `BillDetailTable.tsx`, `BillItemsTable.tsx`, `BillItemRow.tsx`

**Interfaces:**
- Consumes: всё из Task 1.

Соответствие (итоговые классы должны совпасть с нынешними):
- `ConfirmedBillsTable`: `<Table containerClassName="rounded-lg bg-card" className="text-left">`; шапка — `TableHead` (default, `font-medium` уже в базе); строки — `TableRow` + текущие `cursor-pointer outline-none focus-visible:bg-accent hover:bg-accent/40` и `opacity-60`; `font-mono` у суммы через `className`, без `numeric`; `hidden md:table-cell` через `className`. `TableHeader` даёт `bg-muted/50` и границу — убрать дубли `border-b` с `thead`.
- `BillDetailTable`: `<Table density="compact" className="min-w-[44rem] table-fixed">`; `TableHead className="font-bold w-…"` (жирная шапка как у `<th>`); сумма — `TableHead numeric` / `TableCell numeric className="font-mono"`; футер — `TableFooter`, его строка `TableRow` (граница строки футера — последняя в своём `tfoot`, `last:border-b-0`).
- `BillItemsTable`: `<Table density="compact" containerClassName="hidden md:block" className="min-w-[1024px] table-fixed">`; `TableHead className="font-bold w-[…]"`. `BillItemRow`: `<tr className="border-t">` → `TableRow`, `<td className="px-2 py-2">` → `TableCell` (последняя — `className="w-12"`).

- [ ] **Step 1:** Перенести `ConfirmedBillsTable`; `npx vitest run src/pages/bills/components/ConfirmedBillsTable.test.tsx` → PASS.
- [ ] **Step 2:** Перенести `BillDetailTable`; `npx vitest run src/pages/bills/components/BillDetailTable.test.tsx src/pages/bills/components/BillDetailContent.test.tsx` → PASS.
- [ ] **Step 3:** Перенести `BillItemsTable` и `BillItemRow`; `npx vitest run src/pages/bills` → PASS.
- [ ] **Step 4:** Сверка классов: в dev-сервере (`/bills`, деталь чека, правка черновика) через `javascript_tool` сравнить `className` у `th`/`td`/обёртки с `git stash`-версией или с таблицей выше; скриншоты до/после.
- [ ] **Step 5:** `npx eslint src/pages/bills` → без ошибок. Коммит `refactor(bills): bill tables on Table`.

### Task 3: `SegmentedTabs` и `SegmentedNav`

**Files:**
- Create: `src/components/ui/segmented-tabs.tsx`
- Test: `src/components/ui/segmented-tabs.test.tsx`

**Interfaces:**
- Produces:
  - `type SegmentedVariant = 'pill' | 'underline'`
  - `SegmentedTabs<V extends string>(props: { items: { value: V; label: ReactNode; disabled?: boolean }[]; value: V; onValueChange: (v: V) => void; variant?: SegmentedVariant /* 'pill' */; 'aria-label'?: string; idPrefix?: string; className?: string })`
    - `<div role="tablist" aria-label>`, кнопки `type="button" role="tab" aria-selected disabled`; с `idPrefix`: `id={`${idPrefix}-tab-${value}`}`, `aria-controls={`${idPrefix}-panel`}`.
    - `tabIndex`: 0 у выбранной, если она доступна; иначе у первой доступной; остальным −1.
    - `onKeyDown` на списке: ArrowRight/ArrowLeft — следующая/предыдущая доступная по кругу от текущей (выбранной или первой доступной); Home/End — первая/последняя доступная; `preventDefault`, `onValueChange(next)`, фокус на кнопку `next` (refs по индексу). Нет другой доступной — ничего.
  - `SegmentedNav(props: { items: { to: string; label: ReactNode; end?: boolean }[]; variant?: SegmentedVariant /* 'underline' */; 'aria-label'?: string; className?: string })` — `<nav aria-label>`, `NavLink` с классом по `isActive`.
  - Классы (`cva`), ровно как сейчас:
    - список `pill`: `inline-flex w-fit gap-1 rounded-lg bg-muted p-1`; `underline`: `flex gap-1 border-b`.
    - вкладка `pill`: `rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors disabled:opacity-50`, активная + `bg-background text-foreground shadow-sm`.
    - вкладка `underline`: `-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50`, активная `border-foreground text-foreground`, иначе `border-transparent text-muted-foreground hover:text-foreground`.

- [ ] **Step 1: Тесты** (`items = a, b, c`, `value` в состоянии обёртки-харнесса):
  - `marks the selected tab`: `getByRole('tab', {name:'B'})` — `aria-selected="true"`, `tabIndex 0`; остальные `-1`.
  - `ArrowRight moves and wraps`: фокус на C, `{ArrowRight}` → выбрана и в фокусе A.
  - `ArrowLeft moves and wraps`: с A → C.
  - `Home and End`: → A / → C.
  - `skips disabled tabs`: B `disabled`, с A `{ArrowRight}` → C.
  - `only disabled others`: A выбрана, B и C `disabled` — `{ArrowRight}` не вызывает `onValueChange` (`vi.fn`).
  - `selected tab disabled falls back`: `value="b"`, B `disabled` → `tabIndex 0` у A.
  - `click selects`: клик по C → `onValueChange('c')`.
  - `links tabs to the panel`: `idPrefix="x"` → у A `id="x-tab-a"`, `aria-controls="x-panel"`.
  - `pill variant classes`: список `rounded-lg bg-muted p-1`, активная `bg-background shadow-sm`; `underline`: активная `border-foreground`.
  - `SegmentedNav marks the current page`: в `MemoryRouter initialEntries={['/b']}` ссылка B — `aria-current="page"`, `border-foreground`; A — без `aria-current`; `getByRole('navigation', {name})`.
- [ ] **Step 2:** `npx vitest run src/components/ui/segmented-tabs.test.tsx` → FAIL.
- [ ] **Step 3:** Реализовать по Interfaces.
- [ ] **Step 4:** Тот же запуск → PASS; `npx eslint src/components/ui` → без ошибок (включая правило границ импорта).
- [ ] **Step 5:** Коммит `feat(ui): SegmentedTabs and SegmentedNav`.

### Task 4: `BillDetailViews` и `BillsTabs` на новых вкладках

**Files:**
- Modify: `src/pages/bills/components/BillDetailViews.tsx`, `BillsTabs.tsx`
- Test: `src/pages/bills/components/BillDetailViews.test.tsx` (только новый тест)

**Interfaces:**
- Consumes: `SegmentedTabs`, `SegmentedNav` из Task 3.

- [ ] **Step 1:** Добавить тест в `BillDetailViews.test.tsx` — `arrow keys switch views and skip Chart while editing`: без правки фокус на Items, `{ArrowRight}` → Chart выбран; при `editing` — `{ArrowRight}` оставляет Items выбранным.
- [ ] **Step 2:** `npx vitest run src/pages/bills/components/BillDetailViews.test.tsx` → новый тест FAIL.
- [ ] **Step 3:** `BillDetailViews`: `<SegmentedTabs variant="pill" aria-label={…} idPrefix={ids} value={shown} onValueChange={setView} items={VIEWS.map(v => ({ value: v, label: t(…), disabled: v === 'chart' && editing }))} />`; панель остаётся как есть (`id={`${ids}-panel`}`, `aria-labelledby={`${ids}-tab-${shown}`}`).
- [ ] **Step 4:** `BillsTabs`: `<SegmentedNav variant="underline" aria-label={t('tabs.label')} items={[{ to: '/bills', end: true, label: … }, { to: '/bills/drafts', … }, { to: '/bills/duplicates', … }]} />`; подсчёты остаются, `tabClass` удалить.
- [ ] **Step 5:** `npx vitest run src/pages/bills` → PASS; `npx eslint src/pages/bills` → без ошибок.
- [ ] **Step 6:** Коммит `refactor(bills): bill tabs on SegmentedTabs and SegmentedNav`.

### Task 5: Витрина и `docs/ui.md`

**Files:**
- Create: `src/pages/dev/ui/sections/table.tsx`, `src/pages/dev/ui/sections/segmented-tabs.tsx`
- Modify: `src/pages/dev/ui/DevUiPage.test.tsx` (список `id`), `docs/ui.md`

- [ ] **Step 1:** Дописать `'table'` и `'segmented-tabs'` в список в `DevUiPage.test.tsx`; `npx vitest run src/pages/dev/ui` → FAIL.
- [ ] **Step 2:** `table.tsx` (`id='table'`, `title='Table'`, `order=140`): две маленькие таблицы — `default` и `compact`, колонка суммы `numeric`, `TableFooter` с итогом, `TableCaption`.
- [ ] **Step 3:** `segmented-tabs.tsx` (`id='segmented-tabs'`, `title='SegmentedTabs'`, `order=150`): `SegmentedTabs` pill и underline на `useState`, третья вкладка `disabled`, `idPrefix` из `useId`; `SegmentedNav` внутри `<MemoryRouter>` с тремя ссылками.
- [ ] **Step 4:** `npx vitest run src/pages/dev/ui` → PASS (в т.ч. уникальность `id`).
- [ ] **Step 5:** `docs/ui.md`, раздел «Компоненты», после строки про `Select`: «Таблица — `Table` (`density="compact"` для плотных, `numeric` у колонок с числами). Вкладки внутри страницы — `SegmentedTabs` (стрелки, `tablist`); переход между страницами — `SegmentedNav` (`<nav>`, ссылки).»
- [ ] **Step 6:** Открыть `/dev/ui` в dev-сервере, проверить разделы в обеих колонках, стрелки во вкладках; скриншот.
- [ ] **Step 7:** Коммит `feat(ui): showcase sections for Table and SegmentedTabs` (`git add -f docs/ui.md` не нужен — файл уже отслеживается).

### Финальная проверка

- [ ] `npm run test:run` → все PASS; `npm run lint` → 0 ошибок/предупреждений; `npm run build` → успешно.
