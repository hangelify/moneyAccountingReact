// Stop: the agent may not finish with a red `npm run verify`.
// The working tree (tracked + untracked, not ignored) is hashed as a git tree:
//  - unchanged since the last green run -> skip;
//  - red -> block and remember the tree in .claude/.verify-red;
//  - asked to stop again (stop_hook_active) with the SAME red tree -> the agent made no progress:
//    let it stop, but warn the user that verify is red. Any change re-runs verify and blocks again.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ROOT, readInput } from './lib.mjs';

const OK = path.join(ROOT, '.claude', '.verify-ok');
const RED = path.join(ROOT, '.claude', '.verify-red');
const read = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : null);

function treeStamp() {
  const dir = mkdtempSync(path.join(tmpdir(), 'verify-stamp-'));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: path.join(dir, 'index') };
    const git = (...args) =>
      execFileSync('git', args, { cwd: ROOT, env, encoding: 'utf8' }).trim();
    git('read-tree', 'HEAD');
    git('add', '-A');
    return git('write-tree');
  } catch {
    return null; // cannot hash: always run verify
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const input = readInput();
const stamp = treeStamp();

if (stamp !== null && read(OK) === stamp) process.exit(0);
if (input.stop_hook_active && stamp !== null && read(RED) === stamp) {
  process.stdout.write(
    JSON.stringify({
      systemMessage:
        'npm run verify is still red and the agent stopped without changing anything (HAN-130). Do not treat the task as done.',
    })
  );
  process.exit(0);
}

const res = spawnSync('npm', ['run', 'verify', '--silent'], {
  cwd: ROOT,
  encoding: 'utf8',
});
if (res.status === 0) {
  if (stamp !== null) writeFileSync(OK, stamp);
  rmSync(RED, { force: true });
  process.exit(0);
}
if (stamp !== null) writeFileSync(RED, stamp);
const out = `${res.stdout}${res.stderr}`
  .trim()
  .split('\n')
  .slice(-60)
  .join('\n');
process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason: `npm run verify is red — the task is not done (HAN-130). Fix it, then finish.\n${out}`,
  })
);
