import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const dir = 'docs/test-results';
mkdirSync(dir, { recursive: true });
const steps = [
  ['typecheck', ['npm', 'run', 'typecheck']],
  ['unit', ['npm', 'test']],
  ['format', ['npm', 'run', 'format:check']],
  ['build', ['npm', 'run', 'build']],
  ['extension-ui', ['node', 'scripts/extension-ui.mjs']],
  ['color-picker-ui', ['node', 'scripts/color-picker-ui.mjs']],
  ['dock-ui', ['node', 'scripts/dock-ui.mjs']],
  ['ui-polish', ['node', 'scripts/ui-polish.mjs']],
  ['designer-iteration', ['node', 'scripts/designer-iteration.mjs']],
  ['hold-gesture', ['node', 'scripts/hold-gesture.mjs']],
  ['desktop-acceptance', ['node', 'scripts/desktop-acceptance.mjs']],
  ['giant-reachability', ['node', 'scripts/bubble-reachability.mjs']],
  ['layout-pressure', ['node', 'scripts/layout-pressure.mjs']],
  ['integration', ['node', 'scripts/e2e.mjs']],
];
const results = [];
for (const [name, [command, ...args]] of steps) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: { ...process.env, TODOPOP_TEST_PORT: process.env.TODOPOP_TEST_PORT || '17848' },
    timeout: 180000,
    maxBuffer: 10 * 1024 * 1024,
  });
  writeFileSync(
    `${dir}/${name}.log`,
    (result.stdout || '') + (result.stderr || '') + (result.error ? String(result.error) : ''),
  );
  const row = {
    name,
    command: [command, ...args].join(' '),
    exitCode: result.status,
    passed: result.status === 0,
    durationMs: Date.now() - started,
  };
  results.push(row);
  console.log(`${row.passed ? 'PASS' : 'FAIL'} ${name} (${row.durationMs}ms)`);
  if (!row.passed) {
    console.log((result.stdout || '').slice(-2000) + (result.stderr || '').slice(-2000));
    break;
  }
}
writeFileSync(
  `${dir}/summary.json`,
  JSON.stringify(
    {
      date: new Date().toISOString(),
      passed: results.length === steps.length && results.every((r) => r.passed),
      results,
    },
    null,
    2,
  ) + '\n',
);
if (results.length !== steps.length || results.some((r) => !r.passed)) process.exitCode = 1;
