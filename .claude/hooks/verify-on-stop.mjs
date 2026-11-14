// Stop: the agent may not finish with a red `npm run verify`.
// Skips when the tree is unchanged since the last green run (cached in .claude/.verify-ok),
// and when the agent is already continuing because of this hook (stop_hook_active).
import { execSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, readInput } from './lib.mjs';

const input = readInput();
if (input.stop_hook_active) process.exit(0);

const git = (args) => execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' });
const stamp = createHash('sha256')
  .update(git('rev-parse HEAD'))
  .update(git('diff HEAD'))
  .update(git('ls-files --others --exclude-standard'))
  .digest('hex');
const cache = path.join(ROOT, '.claude', '.verify-ok');
if (existsSync(cache) && readFileSync(cache, 'utf8') === stamp) process.exit(0);

const res = spawnSync('npm', ['run', 'verify', '--silent'], { cwd: ROOT, encoding: 'utf8' });
if (res.status === 0) {
  writeFileSync(cache, stamp);
  process.exit(0);
}
const out = `${res.stdout}${res.stderr}`.trim().split('\n').slice(-60).join('\n');
process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason: `npm run verify is red — the task is not done (HAN-130). Fix it, then finish.\n${out}`,
  })
);
