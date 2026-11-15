import path from 'node:path';
import { ESLint, type Linter } from 'eslint';
import { describe, expect, it, vi } from 'vitest';

// The first call loads the whole typed ESLint config; under a loaded parallel suite that can take
// longer than the default 5s.
vi.setConfig({ testTimeout: 60_000 });

const repoRoot = import.meta.dirname;
const eslint = new ESLint({ cwd: repoRoot });

function severityOf(entry: Linter.RuleEntry | undefined): number {
  const level: unknown = Array.isArray(entry) ? entry[0] : entry;
  if (level === 'error' || level === 2) return 2;
  if (level === 'warn' || level === 1) return 1;
  return 0;
}

async function rulesFor(file: string): Promise<Partial<Linter.RulesRecord>> {
  const cfg = (await eslint.calculateConfigForFile(file)) as Linter.Config;
  return cfg.rules ?? {};
}

const REQUIRED_ERRORS = [
  '@typescript-eslint/explicit-function-return-type',
  '@typescript-eslint/prefer-nullish-coalescing',
  '@typescript-eslint/prefer-optional-chain',
  '@typescript-eslint/no-unnecessary-condition',
  '@typescript-eslint/no-non-null-assertion',
  '@typescript-eslint/switch-exhaustiveness-check',
  '@typescript-eslint/no-confusing-void-expression',
  'react-hooks/exhaustive-deps',
  'react-hooks/set-state-in-effect',
  'react-hooks/purity',
  'react-hooks/refs',
  'react-hooks/immutability',
  'react-hooks/incompatible-library',
  'react-refresh/only-export-components',
  'no-console',
  'no-alert',
  'object-shorthand',
  'prefer-arrow-callback',
  'prefer-template',
  'no-warning-comments',
];

const PROBE = `import { useEffect, useState, type ReactElement } from 'react';

export function LintProbe({ id }: { id: string }): ReactElement {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.title = id;
  }, []);
  return (
    <button type="button" onClick={() => setOpen(false)}>
      {String(open)}
    </button>
  );
}
`;

// Lint `code` as if it were the existing project file `rel`. Nothing is written to disk: the
// TypeScript project service does not reliably pick up files created during a run (CI failed with
// "was not found by the project service").
async function lintAs(rel: string, code: string): Promise<string[]> {
  const results = await eslint.lintText(code, {
    filePath: path.join(repoRoot, rel),
  });
  return results.flatMap((r) =>
    r.messages.map((m) => `${m.ruleId ?? ''}: ${m.message}`)
  );
}

describe('eslint config', () => {
  it.each(['src/App.tsx', 'src/contexts/HouseholdContext.test.tsx'])(
    'has no rule at warn severity for %s',
    async (file) => {
      const rules = await rulesFor(file);
      const warn = Object.entries(rules)
        .filter(([, v]) => severityOf(v) === 1)
        .map(([k]) => k);
      expect(warn).toEqual([]);
    }
  );

  it.each(REQUIRED_ERRORS)('%s is error', async (rule) => {
    const rules = await rulesFor('src/App.tsx');
    expect(severityOf(rules[rule])).toBe(2);
  });

  it('flags a new useEffect with missing deps, allows arrow-shorthand void', async () => {
    const messages = (await lintAs('src/App.tsx', PROBE)).join('\n');
    expect(messages).not.toContain('Parsing error');
    expect(messages).toContain('react-hooks/exhaustive-deps');
    expect(messages).not.toContain(
      '@typescript-eslint/no-confusing-void-expression'
    );
  });

  // Mirrors of the dependency-cruiser rules (HAN-126), so the editor shows them.
  it.each([
    [
      'src/hooks/useMarkets.ts',
      "import { Home } from '@/pages/home/Home';\nexport const x = Home;\n",
      'cannot import a page',
    ],
    [
      'src/components/ui/button.tsx',
      "import { useHouseholds } from '@/contexts/HouseholdContext';\nexport const x = useHouseholds;\n",
      'components/ui imports only',
    ],
    [
      'src/components/bills/useBatchUpload.ts',
      "import axios from 'axios';\nexport const x = axios;\n",
      'axios is used only in src/api/',
    ],
  ])('no-restricted-imports in %s', async (rel, code, message) => {
    const messages = (await lintAs(rel, code)).join('\n');
    expect(messages).not.toContain('Parsing error');
    expect(messages).toContain(message);
  });

  it('allows axios in src/api', async () => {
    const messages = (
      await lintAs(
        'src/api/bills.ts',
        "import axios from 'axios';\nexport const x = axios;\n"
      )
    ).join('\n');
    expect(messages).not.toContain('Parsing error');
    expect(messages).not.toContain('no-restricted-imports');
  });
});
