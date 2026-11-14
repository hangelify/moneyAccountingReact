// PreToolUse (Bash): no force-push, no skipping git hooks.
import { block, readInput } from './lib.mjs';

const cmd = String(readInput().tool_input?.command ?? '');

if (/\bgit\b[^\n;&|]*\bpush\b[^\n;&|]*(\s--force(-with-lease)?\b|\s-f\b)/.test(cmd)) {
  block('git push --force is not allowed (HAN-130). Rebase or merge and push normally.');
}
if (/--no-verify\b/.test(cmd) || /\bgit\b[^\n;&|]*\bcommit\b[^\n;&|]*\s-n\b/.test(cmd)) {
  block(
    'Skipping git hooks (--no-verify / commit -n) is not allowed (HAN-130). Fix what the hook reports.'
  );
}
