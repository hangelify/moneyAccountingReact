// PreToolUse (Edit|Write|MultiEdit): the agent may not weaken the checks.
//  1. no edits to lint/arch/type configs, the baseline or the hooks themselves;
//  2. no new eslint-disable / @ts-ignore / @ts-nocheck / `as any` / `as unknown as`.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, block, readInput, relToRoot } from './lib.mjs';

const PROTECTED = [
  /^eslint\.config\.js$/,
  /^eslint-suppressions\.json$/,
  /^\.dependency-cruiser\.c?js$/,
  /^\.jscpd\.json$/,
  /^knip\.json$/,
  /^tsconfig[^/]*\.json$/,
  /^vite\.config\.ts$/,
  /^vitest\.config\.ts$/,
  /^\.claude\/settings\.json$/,
  /^\.claude\/hooks\//,
];

const FORBIDDEN = [
  [/eslint-disable/g, 'eslint-disable'],
  [/@ts-ignore/g, '@ts-ignore'],
  [/@ts-nocheck/g, '@ts-nocheck'],
  [/\bas\s+any\b/g, '`as any`'],
  [/\bas\s+unknown\s+as\b/g, '`as unknown as`'],
];

const count = (text, re) => (text.match(re) ?? []).length;

const input = readInput();
const tool = input.tool_input ?? {};
const rel = relToRoot(tool.file_path);
if (rel === null) process.exit(0);

if (PROTECTED.some((re) => re.test(rel))) {
  block(
    `${rel} is a protected check config (HAN-130). Do not weaken the checks: fix the code instead. ` +
      'If the rule itself is wrong, stop and ask the owner to change it.'
  );
}

// forbidden-text check applies to code only (docs may name the patterns)
if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(rel)) process.exit(0);

// before/after text of the change
const abs = path.join(ROOT, rel);
let before = '';
let after = '';
if (input.tool_name === 'Write') {
  before = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
  after = tool.content ?? '';
} else {
  const edits = tool.edits ?? [tool];
  before = edits.map((e) => e.old_string ?? '').join('\n');
  after = edits.map((e) => e.new_string ?? '').join('\n');
}

for (const [re, label] of FORBIDDEN) {
  if (count(after, re) > count(before, re)) {
    block(
      `New ${label} in ${rel} is not allowed (HAN-130). Fix the cause: correct the types, ` +
        'narrow with a type guard, or restructure the code so the rule passes.'
    );
  }
}
