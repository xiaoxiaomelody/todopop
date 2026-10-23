import { _electron as electron } from 'playwright';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'todopop-reachability-'));
await writeFile(
  join(dir, 'tasks.json'),
  JSON.stringify([
    {
      id: 'giant',
      title: 'Oversized linked bubble',
      urgency: 4,
      url: 'https://example.com/work',
      completed: false,
      createdAt: Date.now(),
      growthMs: 20000000,
    },
  ]),
);
let desktop;
const errors = [],
  checks = [];
try {
  desktop = await electron.launch({
    args: [resolve('apps/desktop')],
    env: { ...process.env, TODOPOP_DATA_DIR: dir },
  });
  desktop.on('window', (p) => p.on('pageerror', (e) => errors.push(String(e))));
  const panel = await desktop.firstWindow();
  await panel.waitForSelector('.panel');
  await panel.evaluate(() => window.todopop.pause('manual'));
  let bubble;
  for (let attempt = 0; attempt < 100 && !bubble; attempt++) {
    bubble = desktop.windows().find((p) => p.url().includes('#bubble=giant'));
    if (!bubble) await new Promise((r) => setTimeout(r, 50));
  }
  assert.ok(bubble);
  await bubble.waitForSelector('.bubble-tools');
  for (const side of ['bottom', 'left', 'top', 'right']) {
    await panel.evaluate((side) => window.todopop.arrange(side), side);
    await bubble.waitForTimeout(150);
    const native = await desktop.evaluate(({ BrowserWindow, screen }) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes('#bubble=giant'),
      );
      return { bounds: win.getBounds(), area: screen.getDisplayMatching(win.getBounds()).workArea };
    });
    assert.ok(native.bounds.width > native.area.height, 'Fixture must exceed screen height');
    const button = bubble.getByRole('button', { name: 'Complete task', exact: true });
    const box = await button.boundingBox();
    assert.ok(box);
    assert.ok(
      Math.abs(box.width - 32) < 1 && Math.abs(box.height - 32) < 1,
      'Controls must not scale with body',
    );
    const x = box.x + native.bounds.x,
      y = box.y + native.bounds.y;
    assert.ok(
      x >= native.area.x && x + box.width <= native.area.x + native.area.width,
      `Outside horizontal work area: ${side}`,
    );
    assert.ok(
      y >= native.area.y && y + box.height <= native.area.y + native.area.height,
      `Outside vertical work area: ${side}`,
    );
    checks.push(`oversized ${side} bubble retains 32px controls inside work area`);
  }
  await bubble.locator('.bubble-tools').hover();
  await bubble
    .locator('.bubble-tools')
    .screenshot({ path: 'docs/screenshots/oversized-bubble-controls.png' });
  await bubble.getByRole('button', { name: 'Complete task', exact: true }).click();
  await panel.waitForFunction(
    async () => (await window.todopop.snapshot()).tasks.find((t) => t.id === 'giant')?.completed,
  );
  checks.push('visible Pop button completes linked giant task without opening its URL');
  assert.deepEqual(errors, []);
  await writeFile(
    'docs/bubble-reachability-result.json',
    JSON.stringify({ passed: true, date: new Date().toISOString(), checks, errors }, null, 2) +
      '\n',
  );
  console.log('PASS giant bubble reachability: four edges, constant controls, actual Pop click');
} finally {
  await desktop?.close();
}
