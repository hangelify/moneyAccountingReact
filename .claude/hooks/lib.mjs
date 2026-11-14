// Shared helpers for the Claude Code hooks (HAN-130). Keep in sync with the server repo (HAN-122).
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');

/** Parsed hook payload from stdin. */
export function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

/** Block the action: exit 2 sends `message` back to the agent. */
export function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

/** Repo-relative POSIX path, or null when the file is outside the repo. */
export function relToRoot(file) {
  if (!file) return null;
  const rel = path.relative(ROOT, path.resolve(ROOT, file));
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}
