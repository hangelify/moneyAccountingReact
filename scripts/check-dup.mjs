// Copy-paste gate (HAN-127): jscpd duplication may only go down.
// A percentage threshold loosens as the codebase grows, so the gate compares absolute numbers
// against .jscpd-baseline.json: more duplicated lines or more clones than the baseline fail.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = mkdtempSync(path.join(tmpdir(), 'jscpd-'));
try {
  const run = spawnSync(
    'npx',
    [
      '--no-install',
      'jscpd',
      '--config',
      '.jscpd.json',
      '--reporters',
      'json',
      '--output',
      out,
      '--silent',
    ],
    { cwd: root, encoding: 'utf8' }
  );
  if (run.status !== 0) {
    process.stderr.write(`${run.stdout}${run.stderr}`);
    process.exit(run.status ?? 1);
  }
  const report = JSON.parse(
    readFileSync(path.join(out, 'jscpd-report.json'), 'utf8')
  );
  const baseline = JSON.parse(
    readFileSync(path.join(root, '.jscpd-baseline.json'), 'utf8')
  );
  const { clones, duplicatedLines } = report.statistics.total;
  const summary = `${String(clones)} clones, ${String(duplicatedLines)} duplicated lines (baseline: ${String(baseline.clones)} / ${String(baseline.duplicatedLines)})`;

  if (clones > baseline.clones || duplicatedLines > baseline.duplicatedLines) {
    const list = report.duplicates
      .map(
        (d) =>
          `  ${d.firstFile.name}:${String(d.firstFile.start)}-${String(d.firstFile.end)} ~ ${d.secondFile.name}:${String(d.secondFile.start)}-${String(d.secondFile.end)}`
      )
      .join('\n');
    process.stderr.write(
      `Copy-paste grew: ${summary}.\nExtract the shared part instead of copying it.\nAll clones:\n${list}\n`
    );
    process.exit(1);
  }
  if (clones < baseline.clones || duplicatedLines < baseline.duplicatedLines) {
    process.stdout.write(
      `dup: ${summary}. Duplication went down — lower .jscpd-baseline.json to these numbers.\n`
    );
  }
} finally {
  rmSync(out, { recursive: true, force: true });
}
