import { _electron as electron } from 'playwright';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'todopop-giant-'));
await writeFile(
  join(dir, 'state.json'),
  JSON.stringify({
    schemaVersion: 2,
    settings: { tutorialDone: true, interactionVersion: 2 },
    tasks: [
      {
        id: 'giant',
        title: 'Oversized linked bubble',
        url: 'https://example.com/work',
        urgency: 4,
        completed: false,
        createdAt: Date.now(),
        growthMs: 20000000,
      },
    ],
  }),
);
let desktop;
const errors = [],
  checks = [];
try {
  desktop = await electron.launch({
    args: [resolve('apps/desktop')],
    env: {
      ...process.env,
      TODOPOP_DATA_DIR: dir,
      TODOPOP_TEST_PORT: process.env.TODOPOP_TEST_PORT || '17848',
    },
  });
  const panel = await desktop.firstWindow();
  await panel.waitForSelector('.control-panel');
  if (await panel.getByRole('button', { name: 'Skip tour', exact: true }).count())
    await panel.getByRole('button', { name: 'Skip tour', exact: true }).click();
  await panel.waitForFunction(async () => (await window.todopop.snapshot()).full);
  const before = (await panel.evaluate(() => window.todopop.snapshot())).tasks[0].growthMs;
  await panel.waitForTimeout(1200);
  assert.equal((await panel.evaluate(() => window.todopop.snapshot())).tasks[0].growthMs, before);
  checks.push('95% visible union coverage stops growth');
  let bubble;
  for (let i = 0; i < 100 && !bubble; i++) {
    bubble = desktop.windows().find((p) => p.url().includes('#bubble=giant'));
    if (!bubble) await new Promise((r) => setTimeout(r, 50));
  }
  assert.ok(bubble);
  bubble.on('pageerror', (e) => errors.push(String(e)));
  await bubble.waitForSelector('.organic-hit');
  assert.equal(await bubble.locator('.bubble-tools').count(), 0);
  for (const side of ['bottom', 'left', 'top', 'right']) {
    await panel.evaluate((side) => window.todopop.arrange(side), side);
    await bubble.waitForTimeout(100);
    const native = await desktop.evaluate(({ BrowserWindow, screen }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes('#bubble=giant'),
      );
      return { bounds: w.getBounds(), area: screen.getDisplayMatching(w.getBounds()).workArea };
    });
    assert.ok(native.bounds.x >= native.area.x && native.bounds.y >= native.area.y);
    assert.ok(
      native.bounds.width <= native.area.width && native.bounds.height <= native.area.height,
    );
    const point = await bubble.evaluate(() => {
      for (let y = 20; y < innerHeight - 10; y += 20)
        for (let x = 20; x < innerWidth - 10; x += 20)
          if (document.elementFromPoint(x, y)?.classList.contains('organic-hit')) return { x, y };
      return null;
    });
    assert.ok(point, `No visible hit target at ${side}`);
    checks.push(`giant ${side} bubble body remains reachable for hold-to-Pop`);
  }
  const point = await bubble.evaluate(() => {
    for (let y = 20; y < innerHeight - 10; y += 20)
      for (let x = 20; x < innerWidth - 10; x += 20)
        if (document.elementFromPoint(x, y)?.classList.contains('organic-hit')) return { x, y };
  });
  await bubble.mouse.click(point.x, point.y, { delay: 950 });
  await panel.waitForFunction(
    async () => (await window.todopop.snapshot()).tasks.find((t) => t.id === 'giant')?.completed,
  );
  checks.push('actual long press completes linked giant bubble with no attached buttons');
  await panel.evaluate(() => window.todopop.create({ title: 'Space is back', urgency: 4 }));
  await panel.waitForFunction(async () => {
    const s = await window.todopop.snapshot();
    return !s.full && s.tasks.find((t) => t.title === 'Space is back').growthMs > 0;
  });
  checks.push('Pop frees space and growth resumes for remaining tasks');
  assert.deepEqual(errors, []);
  await writeFile(
    'docs/bubble-reachability-result.json',
    JSON.stringify({ passed: true, date: new Date().toISOString(), checks, errors }, null, 2) +
      '\n',
  );
  console.log('PASS giant bubble: four reachable body anchors and actual hold-to-Pop');
} finally {
  await desktop?.close();
}
