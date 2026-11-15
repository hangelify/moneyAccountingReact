// PreToolUse (Edit|Write|MultiEdit): the agent may not weaken the checks.
//  1. no edits to check configs, the baselines, hooks/CI wiring or the hooks themselves;
//  2. no change to package.json "scripts" (verify/lint must stay what they are);
//  3. no new lint/type escape hatches in code (counted over the whole file before vs after).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, block, readInput, relToRoot } from './lib.mjs';

const PROTECTED = [
  /^eslint\.config\.js$/,
  /^eslint-suppressions\.json$/,
  /^\.dependency-cruiser\.c?js$/,
  /^\.jscpd(-baseline)?\.json$/,
  /^scripts\/check-dup\.mjs$/,
  /^knip\.json$/,
  /^tsconfig[^/]*\.json$/,
  /^vite\.config\.ts$/,
  /^vitest\.config\.ts$/,
  /^\.lintstagedrc[^/]*$/,
  /^\.husky\//,
  /^\.github\//,
  /^\.prettierrc[^/]*$/,
  /^\.prettierignore$/,
  /^\.nvmrc$/,
  /^\.claude\/settings\.json$/,
  /^\.claude\/hooks\//,
];

const FORBIDDEN = [
  [/eslint-disable/g, 'eslint-disable'],
  [/\/\*\s*eslint\s+[\w@/-]+\s*:/g, 'inline `/* eslint rule: … */` config'],
  [/@ts-ignore/g, '@ts-ignore'],
  [/@ts-expect-error/g, '@ts-expect-error'],
  [/@ts-nocheck/g, '@ts-nocheck'],
  [/\bas\s+any\b/g, '`as any`'],
  [/\bas\s+unknown\s+as\b/g, '`as unknown as`'],
];

const count = (text, re) => (text.match(re) ?? []).length;

function applyEdit(text, e) {
  const from = e.old_string ?? '';
  if (!from || !text.includes(from)) return null;
  return e.replace_all
    ? text.split(from).join(e.new_string ?? '')
    : text.replace(from, () => e.new_string ?? '');
}

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

// whole-file text before and after the change
const abs = path.join(ROOT, rel);
const current = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
let before = current;
let after;
if (input.tool_name === 'Write') {
  after = tool.content ?? '';
} else {
  after = current;
  for (const e of tool.edits ?? [tool]) {
    const next = applyEdit(after, e);
    if (next === null) {
      // the tool will reject this edit itself; judge the fragments
      before = (tool.edits ?? [tool]).map((x) => x.old_string ?? '').join('\n');
      after = (tool.edits ?? [tool]).map((x) => x.new_string ?? '').join('\n');
      break;
    }
    after = next;
  }
}

if (rel === 'package.json') {
  let changed;
  try {
    changed =
      JSON.stringify(JSON.parse(before).scripts) !==
      JSON.stringify(JSON.parse(after).scripts);
  } catch {
    block('package.json would not be valid JSON after this edit.');
  }
  if (changed) {
    block(
      'package.json "scripts" are protected (HAN-130): verify, lint and the other checks must stay as they are. ' +
        'Ask the owner to change a script.'
    );
  }
  process.exit(0);
}

// escape hatches: code files only (docs may name the patterns)
if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(rel)) process.exit(0);
for (const [re, label] of FORBIDDEN) {
  if (count(after, re) > count(before, re)) {
    block(
      `New ${label} in ${rel} is not allowed (HAN-130). Fix the cause: correct the types, ` +
        'narrow with a type guard, or restructure the code so the rule passes.'
    );
  }
}
