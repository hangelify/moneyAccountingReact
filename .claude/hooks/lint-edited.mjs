// PostToolUse (Edit|Write|MultiEdit): lint the edited .ts/.tsx file right away and hand errors back.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, block, readInput, relToRoot } from './lib.mjs';

const input = readInput();
const rel = relToRoot(input.tool_input?.file_path);
if (
  rel === null ||
  !/\.(ts|tsx)$/.test(rel) ||
  !existsSync(path.join(ROOT, rel))
)
  process.exit(0);

const res = spawnSync(
  'npx',
  [
    '--no-install',
    'eslint',
    '--max-warnings',
    '0',
    '--no-warn-ignored',
    // a fixed baselined violation is good news; verify/pre-commit prune the baseline
    '--pass-on-unpruned-suppressions',
    rel,
  ],
  { cwd: ROOT, encoding: 'utf8' }
);
if (res.status !== 0) {
  block(
    `ESLint failed on ${rel} — fix it before moving on:\n${res.stdout}${res.stderr}`.trim()
  );
}
