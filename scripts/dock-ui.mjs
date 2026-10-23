import { _electron as electron } from 'playwright';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'todopop-dock-'));
await writeFile(
  join(dir, 'state.json'),
  JSON.stringify({
    schemaVersion: 2,
    tasks: [],
    settings: { tutorialDone: true, interactionVersion: 1 },
  }),
);
let app;
const checks = [],
  errors = [];
async function start() {
  app = await electron.launch({
    args: [resolve('apps/desktop')],
    env: { ...process.env, TODOPOP_DATA_DIR: dir, TODOPOP_TEST_PORT: '17848' },
  });
  const page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.waitForSelector('.is-compact');
  return page;
}
async function until(fn) {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Dock did not settle');
}
try {
  let page = await start(),
    win = await app.browserWindow(page);
  await until(async () => (await win.evaluate((w) => w.getBounds())).width === 300);
  const initial = await win.evaluate((w) => ({ bounds: w.getBounds(), movable: w.isMovable() }));
  assert.equal(initial.movable, true);
  assert.ok(initial.bounds.height < 90);
  const items = await page.locator('.control-bar button').evaluateAll((nodes) =>
    nodes.map((n) => {
      const b = n.getBoundingClientRect();
      return { x: b.x, right: b.right };
    }),
  );
  assert.ok(items.every((b) => b.x >= 0 && b.right <= 300));
  const style = await page.locator('.control-bar').evaluate((el) => ({
    radius: getComputedStyle(el).borderRadius,
    background: getComputedStyle(el).backgroundColor,
  }));
  assert.equal(style.radius, '999px');
  assert.equal(await page.locator('.dock-sticker').count(), 0);
  checks.push('plain white oval without sticker outline');
  checks.push('compact 300px dock with visible controls and movable native window');
  const grip = await page.getByRole('button', { name: 'Move TODOPOP', exact: true }).boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 70, grip.y + grip.height / 2 + 50);
  await page.mouse.up();
  await until(async () =>
    Boolean((await page.evaluate(() => window.todopop.snapshot())).settings.panelPosition),
  );
  const moved = await win.evaluate((w) => w.getBounds());
  assert.ok(Math.abs(moved.x - initial.bounds.x) > 30);
  assert.ok(Math.abs(moved.y - initial.bounds.y) > 20);
  checks.push('actual grip pointer drag changes native position and saves it');
  await page.getByRole('button', { name: 'Blow a bubble', exact: true }).click();
  await until(async () => (await win.evaluate((w) => w.getBounds())).width === 340);
  const open = await win.evaluate((w) => w.getBounds());
  assert.equal(open.x, moved.x);
  assert.equal(open.y, moved.y);
  await page.getByRole('button', { name: 'Blow a bubble', exact: true }).click();
  await until(async () => (await win.evaluate((w) => w.getBounds())).width === 300);
  assert.equal((await win.evaluate((w) => w.getBounds())).x, moved.x);
  checks.push('logo click opens content without dragging; expansion/collapse keeps the anchor');
  await page.getByRole('button', { name: 'Move TODOPOP', exact: true }).focus();
  await page.getByRole('button', { name: 'Move TODOPOP', exact: true }).press('ArrowRight');
  await until(async () => (await win.evaluate((w) => w.getBounds())).x === moved.x + 16);
  await page.getByRole('button', { name: 'Move TODOPOP', exact: true }).press('ArrowLeft');
  await until(async () => (await win.evaluate((w) => w.getBounds())).x === moved.x);
  checks.push('keyboard arrow keys nudge the dock without triggering logo actions');
  await page.locator('.dock-grip').evaluate((el) => el.blur());
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: 'docs/screenshots/movable-dock.png',
    omitBackground: true,
    animations: 'disabled',
  });
  await app.close();
  app = null;
  page = await start();
  win = await app.browserWindow(page);
  await until(async () => (await win.evaluate((w) => w.getBounds())).width === 300);
  const restored = await win.evaluate((w) => w.getBounds());
  assert.equal(restored.x, moved.x);
  assert.equal(restored.y, moved.y);
  checks.push('restart restores saved dock position');
  await page.evaluate(() => {
    window.todopop.dragPanel('start', 0, 0);
    window.todopop.dragPanel('move', 100000, 100000);
    window.todopop.dragPanel('end', 100000, 100000);
  });
  await until(async () => {
    const b = await win.evaluate((w) => w.getBounds());
    return b.x !== restored.x;
  });
  const edge = await app.evaluate(({ BrowserWindow, screen }) => {
    const w = BrowserWindow.getAllWindows().find((w) => !new URL(w.webContents.getURL()).hash);
    return { b: w.getBounds(), a: screen.getDisplayMatching(w.getBounds()).workArea };
  });
  assert.ok(
    edge.b.x >= edge.a.x &&
      edge.b.y >= edge.a.y &&
      edge.b.x + edge.b.width <= edge.a.x + edge.a.width &&
      edge.b.y + edge.b.height <= edge.a.y + edge.a.height,
  );
  checks.push('dragging beyond screen clamps the whole dock to the work area');
  assert.deepEqual(errors, []);
  await writeFile(
    'docs/dock-ui-result.json',
    JSON.stringify(
      {
        passed: true,
        version: await app.evaluate(({ app }) => app.getVersion()),
        date: new Date().toISOString(),
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'PASS movable dock: compact layout, pointer drag, persistence, panel anchor and screen limits',
  );
} finally {
  await app?.close();
}
