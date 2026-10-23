import { _electron as electron } from 'playwright';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'todopop-pressure-'));
const tasks = Array.from({ length: 30 }, (_, i) => ({
  id: `pressure-${i}`,
  title: `Task ${i + 1}`,
  urgency: (i % 4) + 1,
  groupId: null,
  completed: false,
  createdAt: Date.now(),
  growthMs: 0,
}));
await writeFile(
  join(dir, 'state.json'),
  JSON.stringify({
    schemaVersion: 2,
    tasks,
    settings: { tutorialDone: true, interactionVersion: 1 },
  }),
);
let desktop;
const errors = [];
try {
  desktop = await electron.launch({
    args: [resolve('apps/desktop')],
    env: {
      ...process.env,
      TODOPOP_DATA_DIR: dir,
      TODOPOP_TEST_PORT: process.env.TODOPOP_TEST_PORT || '17848',
    },
    timeout: 30000,
  });
  desktop.on('window', (p) => p.on('pageerror', (e) => errors.push(String(e))));
  const panel = await desktop.firstWindow();
  await panel.waitForSelector('.control-panel');
  await panel.waitForFunction(async () => (await window.todopop.snapshot()).tasks.length === 30);
  const deadline = Date.now() + 30000;
  while (
    desktop.windows().filter((p) => p.url().includes('#bubble=')).length < 30 &&
    Date.now() < deadline
  )
    await new Promise((r) => setTimeout(r, 100));
  const bubbles = desktop.windows().filter((p) => p.url().includes('#bubble='));
  assert.equal(bubbles.length, 30);
  await Promise.all(bubbles.map((p) => p.waitForSelector('.organic-hit')));
  const times = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await panel.evaluate(() => window.todopop.snapshot());
    times.push(performance.now() - start);
  }
  const state = await panel.evaluate(() => window.todopop.snapshot());
  const example = state.tasks.find(
    (t) => t.urgency === 4 && !t.renderOffset.x && !t.renderOffset.y,
  );
  if (example) {
    const p = bubbles.find((p) => p.url().includes(`#bubble=${example.id}`));
    await p.screenshot({ path: 'docs/screenshots/squish-bubble.png', omitBackground: true });
  }
  await panel.evaluate(() => window.todopop.open('pressure-0'));
  await panel.waitForFunction(
    async () => (await window.todopop.snapshot()).billboardId === 'pressure-0',
  );
  assert.equal(
    await desktop.evaluate(
      ({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().filter(
          (w) => w.webContents.getURL().includes('#bubble=') && w.isVisible(),
        ).length,
    ),
    0,
  );
  await panel.evaluate(() => window.todopop.exitFocus());
  assert.equal(
    await desktop.evaluate(
      ({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().filter(
          (w) => w.webContents.getURL().includes('#bubble=') && w.isVisible(),
        ).length,
    ),
    30,
  );
  assert.deepEqual(errors, []);
  const result = {
    passed: true,
    date: new Date().toISOString(),
    bubbles: 30,
    snapshotMs: times,
    coverage: state.coverage,
    checks: [
      '30 native bubble renderers loaded',
      'local focus hides all 30',
      'return restores all 30',
      'zero renderer errors',
    ],
    errors,
  };
  await writeFile('docs/layout-pressure-result.json', JSON.stringify(result, null, 2) + '\n');
  console.log(
    `PASS 30 native bubbles; snapshot timings ${times.map((n) => Math.round(n)).join('/')} ms; local focus and return`,
  );
} finally {
  await desktop?.close();
}
