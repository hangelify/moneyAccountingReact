# UI: токены цветов и компоненты

Правила для вёрстки фронта. Эпик HAN-104, задача HAN-105.

## Только токены

Цвета берутся только из семантических токенов. Они заданы как HSL-переменные в `src/index.css`
(`:root` — светлая тема, `.dark` — тёмная) и подключены как цвета в `tailwind.config.js`.
Поэтому одна и та же разметка правильно выглядит в обеих темах.

Сырые цвета палитры Tailwind (`bg-yellow-50`, `text-gray-500`, `dark:text-green-50`, `border-red-300` …)
запрещены ESLint-правилом `no-restricted-syntax`, уровень `error`. Единственное исключение —
затемнение под модальным окном `bg-black/80` в `src/components/ui/dialog.tsx` и `sheet.tsx`.

| Токен | Когда брать |
|---|---|
| `background` / `foreground` | фон страницы и основной текст |
| `card` / `card-foreground` | карточки, блоки на странице |
| `popover` / `popover-foreground` | выпадающие меню, поповеры |
| `muted` / `muted-foreground` | приглушённый фон (бейджи, вкладки), второстепенный текст |
| `primary` / `primary-foreground` | главная кнопка, акцент |
| `secondary` / `secondary-foreground` | второстепенная кнопка |
| `accent` / `accent-foreground` | подсветка при наведении, выбранный пункт |
| `destructive` / `destructive-foreground` | ошибка, удаление |
| `success` / `success-foreground` | успех: сохранено, подтверждено |
| `warning` / `warning-foreground` | внимание: расхождение сумм, возможный дубликат, низкая уверенность AI |
| `info` / `info-foreground` | нейтральная подсказка |
| `border`, `input`, `ring` | рамки, поля ввода, фокус |
| `chart-1` … `chart-8` | серии графиков |

## Цвета состояний (`success`, `warning`, `info`, `destructive`)

`DEFAULT` — насыщенный цвет, `foreground` — текст поверх него.

- **Мягкая поверхность** (баннер, бейдж): `border-<state>/40 bg-<state>/10 text-<state>`.
- **Иконка или текст:** `text-<state>`.
- **Сплошная заливка:** `bg-<state> text-<state>-foreground`.
- **Всплывающие элементы** (тост, поповер) лежат поверх страницы и должны быть непрозрачными.
  Оттенок состояния кладётся поверх `bg-background`, как в `toast.tsx`:
  `bg-background bg-[linear-gradient(hsl(var(--success)/0.1),hsl(var(--success)/0.1))]`.

## Новый токен

1. Добавить переменную в `:root` и `.dark` в `src/index.css` (HSL-тройка без `hsl()`).
2. Добавить цвет в `tailwind.config.js` по образцу `destructive`.
3. Для токена состояния добавить его в `STATES` в `src/theme-tokens.test.ts`: тест проверяет контраст AA (≥ 4.5:1)
   на фоне, на мягкой поверхности `/10` и для `foreground` на заливке, в обеих темах.

## Компоненты

- Лежат в `src/components/ui` (по образцу shadcn/ui).
- Импортируют только `@/lib/*` и пакеты. Данные приложения приходят через props: это проверяют ESLint и dependency-cruiser.
- Варианты задаются через `cva`, классы склеиваются через `cn` из `@/lib/utils`.
- Перед тем как верстать заново, проверьте, нет ли уже готового компонента.
- Простой список — `Select` (нативный `<select>`); выбор с поиском — `CategoryPicker`.
- Таблица — `Table` (`density="compact"` для плотных, `numeric` у колонок с числами). Вкладки внутри страницы —
  `SegmentedTabs` (стрелки, `tablist`); переход между страницами — `SegmentedNav` (`<nav>`, ссылки).

**Как добавить компонент:** файл в `src/components/ui`, рядом тест `*.test.tsx`, только токены цветов,
затем раздел в витрине.

## Витрина

Страница `/dev/ui` (`npm run dev`, затем http://localhost:5173/dev/ui) показывает компоненты
во всех вариантах и все цветовые токены. Пока без раздела: `popover`, `command`, `label`, `form`. Она есть только в dev-сборке: в production роут не
создаётся и код витрины не попадает в бандл. Вход без логина.

Каждый раздел показан в двух колонках: светлой (класс `.light`) и тёмной (класс `.dark`).
Диалоги, меню, тултипы и тосты открываются порталом в `<body>`, поэтому берут тему всей страницы,
её меняет переключатель наверху витрины.

Не используйте вариант `dark:` (`dark:bg-…`): при `darkMode: ['class']` он срабатывает внутри любого
`.dark`, в том числе у светлой колонки на тёмной странице. Разница между темами — только через токены.

**Как добавить раздел.** Файл `src/pages/dev/ui/sections/<id>.tsx` экспортирует константы-литералы
`id`, `title`, `order` и компонент `Section`:

```tsx
export const id = 'badge';
export const title = 'Badge';
export const order = 110; // встроенные разделы идут с шагом 10

export function Section(): ReactElement {
  return <Badge>New</Badge>;
}
```

Страница подхватывает файл сама (`import.meta.glob` в `src/pages/dev/ui/registry.ts`). Затем
допишите `id` в список в `src/pages/dev/ui/DevUiPage.test.tsx`. Вспомогательные файлы кладите
рядом с `registry.ts`, не в `sections/`: каждый файл там должен быть разделом.
