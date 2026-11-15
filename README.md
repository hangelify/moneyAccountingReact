# Accounting React App

A modern React application built with TypeScript, shadcn/ui, React Router, and TanStack Query.

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety with strict rules
- **Vite** - Build tool and dev server
- **shadcn/ui** - UI component library
- **React Router** - Client-side routing
- **TanStack Query** - Server state management
- **Tailwind CSS** - Utility-first CSS framework
- **Vitest** - Unit testing framework
- **ESLint** - Code linting with strong rules
- **Prettier** - Code formatting
- **Husky** - Git hooks
- **lint-staged** - Pre-commit linting

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Install dependencies:

```bash
npm install
```

2. Copy the environment variables file:

```bash
cp .env.example .env
```

3. Update `.env` with your configuration values. All environment variables must be prefixed with `VITE_` to be accessible in the browser.

### Environment Variables

The project uses Vite's environment variable system. Create a `.env` file based on `.env.example`:

```env
VITE_API_URL=http://localhost:3000
VITE_API_TIMEOUT=30000
VITE_NODE_ENV=development
VITE_APP_NAME=Accounting App
VITE_APP_VERSION=1.0.0
```

Access environment variables in your code using the `env` utility:

```typescript
import { env } from '@/lib/env';

// Use env.apiUrl, env.apiTimeout, etc.
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Building

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Code Quality

### Linting

Run ESLint:

```bash
npm run lint
```

Fix linting issues automatically (also drops baseline entries the fixes resolved):

```bash
npm run lint:fix
```

#### Baseline (`eslint-suppressions.json`)

Every rule is `error`; nothing is `warn`. Violations that existed when the strict config landed
(HAN-124) are frozen in `eslint-suppressions.json` as counts per file and rule. New code must be clean:
one violation over the frozen count fails `npm run lint`.

- Fixed a frozen violation? Run `npm run lint:prune` (pre-commit does it for staged files) and commit
  the smaller `eslint-suppressions.json`.
- Never grow the file by hand or with `--suppress-all` / `--suppress-rule` — fix the code instead.
- Counts are per file and rule: fixing one violation and adding another of the same rule in the same
  file goes unnoticed, so do not trade them.

### Formatting

Format code with Prettier:

```bash
npm run format
```

Check formatting without making changes:

```bash
npm run format:check
```

### Type Checking

Run TypeScript type checking:

```bash
npm run type-check
```

### Testing

Run tests in watch mode:

```bash
npm run test
```

Run tests with UI:

```bash
npm run test:ui
```

Run tests once:

```bash
npm run test:run
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Checks

One command runs every check — for people, for the AI agent and (as parallel jobs) in CI:

```bash
npm run verify
```

It runs, in order and stopping at the first failure: `type-check` → `lint` → `format:check` → `test:run`.
"Done" means `npm run verify` is green. CI (`.github/workflows/ci.yml`) runs the same scripts as
separate jobs plus `build`; keep both in sync when a step is added.

## Git Hooks

The project uses Husky for git hooks:

- **pre-commit** (fast, staged files only): ESLint with `--max-warnings 0 --fix` (pruning the baseline it
  resolved) and Prettier. No full type-check here.
- **pre-push**: `npm run verify`.

Do not skip them with `--no-verify`: CI runs the same checks and blocks the merge.

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and pull request:

- **Lint and Format Check**: Runs Prettier and ESLint
- **Type Check**: Runs TypeScript type checking
- **Tests**: Runs all tests
- **Build**: Builds the project

## Project Structure

```
src/
├── components/     # React components
│   └── ui/        # shadcn/ui components
├── hooks/         # Custom React hooks
├── lib/           # Utility functions
│   ├── env.ts     # Environment variables
│   └── utils.ts   # General utilities
├── test/          # Test setup files
├── App.tsx        # Main app component
└── main.tsx       # Entry point
```

## Adding shadcn/ui Components

To add a new shadcn/ui component:

```bash
npx shadcn@latest add [component-name]
```

For example:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
```

## Using TanStack Query

Example hook for API requests:

```typescript
import { useQuery } from '@tanstack/react-query';
import { env } from '@/lib/env';

export function useExampleData() {
  return useQuery({
    queryKey: ['example'],
    queryFn: async () => {
      const response = await fetch(`${env.apiUrl}/example`);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      return response.json();
    },
  });
}
```

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
