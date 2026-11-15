# HAN-111 — Компоненты `Table` и `SegmentedTabs`

Эпик HAN-104. Задача: https://linear.app/hangelify/issue/HAN-111

## Зачем

Три таблицы чеков и переключатели-вкладки сверстаны вручную, каждая копия по-своему. Общие компоненты
нужны, чтобы стиль правился в одном месте, а новые экраны (HAN-82 превью импорта, HAN-61 «Категории»)
не добавляли новых копий.

## Текущее состояние

- **Таблицы.** `ConfirmedBillsTable`: обёртка `overflow-x-auto rounded-lg border bg-card`, `px-3`,
  шапка `font-medium`, `border-b` на `thead` и строках (`last:border-b-0`), сумма слева `font-mono`.
  `BillDetailTable` и `BillItemsTable` (+ строки `BillItemRow`): обёртка `overflow-x-auto rounded-md border`,
  `px-2`, шапка жирная (умолчание `<th>`), `table-fixed` с шириной колонок в процентах, `border-t` на строках;
  у `BillDetailTable` ещё `tfoot` `border-t bg-muted/30` и сумма справа `font-mono`.
- **Вкладки.** `BillsTabs` — `<nav>` из `NavLink` с подчёркиванием (`-mb-px border-b-2`).
  `BillDetailViews` — «таблетка» `inline-flex w-fit gap-1 rounded-lg bg-muted p-1`, `role="tablist"`,
  кнопки с `aria-selected`, `aria-controls`, `tabpanel`, вкладка Chart бывает `disabled`.
  Стрелками сейчас не переключается ничего.

## Цели / не цели

- **Цели:** `src/components/ui/table.tsx`, `src/components/ui/segmented-tabs.tsx` с тестами; три таблицы,
  `BillsTabs` и `BillDetailViews` на них; разделы в витрине; строка в `docs/ui.md`.
- **Не цели:** `CurrencyTabs` и `PeriodPicker` — отдельная задача HAN-144 (решение владельца);
  таблица «по описанию колонок»; сортировка, выбор строк.
- **Анти-цели:** заметное изменение вида (правило эпика); сломать раскладку «таблица на десктопе /
  карточки на мобильном» в `BillItemsTable`; сломать существующие тесты.

## Подходы

**Table.** Один разумный путь — набор примитивов по образцу shadcn. Таблица по описанию колонок
отпадает: строки `BillItemRow` редактируемые, а раскладка таблица/карточки живёт снаружи.

**SegmentedTabs** — выбран **A: свой режим кнопок** (~80 строк, без новых зависимостей, разметка
совпадает с текущей один в один). Отклонён B: `@radix-ui/react-tabs` — готовая клавиатура, но новая
зависимость и свои `data-state`/`id`, разметку `BillDetailViews` пришлось бы подгонять.

## Дизайн

### `Table` (`src/components/ui/table.tsx`)

- `Table` — `<div>` с `overflow-x-auto rounded-md border` (класс через `containerClassName`) и внутри
  `<table className="w-full text-sm">` (`className`). Проп `density: 'default' | 'compact'` (умолч. `default`)
  передаётся контекстом в ячейки: `default` = `px-3 py-2`, `compact` = `px-2 py-2`.
- `TableHeader` — `<thead>` `border-b bg-muted/50 text-left` (граница на `thead`, как сейчас в списке чеков).
- `TableBody`, `TableFooter` (`border-t bg-muted/30 font-medium`), `TableCaption`.
- `TableRow` — `border-b last:border-b-0`. Визуально это то же, что `border-t` на строках у таблиц чека.
- `TableHead` — `font-medium`; `TableCell`. Оба принимают `numeric` → `text-right tabular-nums`.
- Всё, чем таблицы отличаются сверх этого, передаётся через `className` на месте, чтобы вид не менялся:
  `rounded-lg bg-card` у списка чеков, жирная шапка у таблиц чека, `font-mono` у сумм, `table-fixed`,
  `min-w-*` и ширины колонок, `hidden md:block` у обёртки `BillItemsTable`.
- Сумма в `ConfirmedBillsTable` остаётся слева (без `numeric`), в `BillDetailTable` — `numeric` + `font-mono`.

### `SegmentedTabs` (`src/components/ui/segmented-tabs.tsx`)

Общие классы через `cva`, `variant: 'pill' | 'underline'` — ровно текущие классы `BillDetailViews` и `BillsTabs`.

- **`SegmentedTabs`** — кнопки, `role="tablist"`. Пропсы: `items: { value, label, disabled? }[]`, `value`,
  `onValueChange`, `variant`, `aria-label`, `idPrefix?`. С `idPrefix` у вкладки `id={idPrefix}-tab-{value}`
  и `aria-controls={idPrefix}-panel`; панель рисует вызывающий (как сейчас в `BillDetailViews`).
  - Фокус «бродячий»: `tabIndex=0` только у выбранной, у остальных `-1`.
  - ←/→ — соседняя вкладка по кругу, Home/End — первая/последняя; недоступные пропускаются.
    Активация автоматическая: стрелка сразу выбирает вкладку и переводит на неё фокус.
- **`SegmentedNav`** — ссылки, `<nav aria-label>` из `NavLink` (`react-router-dom`), `aria-current="page"`
  ставит сам `NavLink`. Пропсы: `items: { to, label, end? }[]`, `variant`, `aria-label`. Без стрелок и без
  `tablist`: по ссылкам ходят Tab'ом.

### Перенос

- `ConfirmedBillsTable` (`default`), `BillDetailTable` и `BillItemsTable` + `BillItemRow` (`compact`) — на `Table*`.
- `BillsTabs` — на `SegmentedNav variant="underline"`; подсчёт черновиков и дублей остаётся в нём.
- `BillDetailViews` — на `SegmentedTabs variant="pill"` с `idPrefix` из `useId`.

### Витрина и документация

- `src/pages/dev/ui/sections/table.tsx` (order 140): обе плотности, `numeric`, футер, подпись.
- `src/pages/dev/ui/sections/segmented-tabs.tsx` (order 150): оба варианта кнопок, с недоступной вкладкой;
  `SegmentedNav` внутри `MemoryRouter`, чтобы клик не уводил со страницы витрины.
- `docs/ui.md`: таблица — `Table`; вкладки внутри страницы — `SegmentedTabs`, переход между страницами — `SegmentedNav`.

## Тесты

- `table.test.tsx`: плотность доходит до ячеек; `numeric` даёт `text-right tabular-nums`; `className` склеивается.
- `segmented-tabs.test.tsx`: ←/→ по кругу, Home/End, пропуск `disabled`, `tabIndex`, `onValueChange`, связь
  `aria-controls`; у `SegmentedNav` — `aria-current` у активной ссылки.
- Существующие тесты `ConfirmedBillsTable`, `BillDetailTable`, `BillDetailViews`, `BillsTabs`, `BillItemRow` проходят
  без правок.

## Оставлено исполнителю

Точная форма пропсов и типы, состав `cva`, тексты примеров в витрине. Мои решения в спеке:
`TableRow` с `border-b last:border-b-0` вместо `border-t`; автоматическая активация вкладок;
`SegmentedNav` отдельным экспортом из того же файла; номера `order` 140/150 (110 в `docs/ui.md` приведён как пример для Badge).
