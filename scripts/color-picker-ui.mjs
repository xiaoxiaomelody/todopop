import { _electron as electron } from 'playwright';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'todopop-colors-'));
await writeFile(
  join(dir, 'state.json'),
  JSON.stringify({
    schemaVersion: 2,
    tasks: [
      {
        id: 'colored',
        title: 'Color regression',
        groupId: 'School',
        urgency: 4,
        completed: false,
        createdAt: Date.now(),
      },
    ],
    settings: { tutorialDone: true, interactionVersion: 2 },
  }),
);
let app;
const checks = [],
  errors = [];
async function until(fn) {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Color state did not settle');
}
try {
  app = await electron.launch({
    args: [resolve('apps/desktop')],
    env: { ...process.env, TODOPOP_DATA_DIR: dir, TODOPOP_TEST_PORT: '17848' },
  });
  app.on('window', (p) => p.on('pageerror', (e) => errors.push(String(e))));
  const panel = await app.firstWindow();
  await panel.waitForSelector('.control-panel');
  await panel.getByRole('button', { name: 'Tint and groups', exact: true }).click();
  const native = await app.browserWindow(panel);
  const before = await native.evaluate((w) => w.getBounds());
  await panel.evaluate(() => {
    window.__imageDrags = 0;
    document.addEventListener('dragstart', () => window.__imageDrags++);
  });
  const ring = panel.getByRole('slider', { name: 'Tint hue', exact: true });
  assert.equal(
    await ring.locator('img').evaluateAll((imgs) => imgs.every((img) => img.draggable === false)),
    true,
  );
  const bounds = await ring.boundingBox();
  await panel.mouse.move(bounds.x + 75, bounds.y + 10);
  await panel.mouse.down();
  await panel.mouse.move(bounds.x + 140, bounds.y + 75, { steps: 12 });
  await panel.mouse.up();
  await until(
    async () => (await panel.evaluate(() => window.todopop.snapshot())).settings.tint !== '#1a419e',
  );
  assert.equal(await panel.evaluate(() => window.__imageDrags), 0);
  const after = await native.evaluate((w) => w.getBounds());
  assert.equal(after.x, before.x);
  assert.equal(after.y, before.y);
  checks.push(
    'actual hue-ring drag changes color with zero image drag events and no dock movement',
  );
  for (const tint of ['#1a249e', '#9c1c31', '#078b86', '#292929']) {
    const hex = panel.getByRole('textbox', { name: 'Tint HEX', exact: true });
    await hex.fill(tint);
    await hex.press('Enter');
    await until(
      async () => (await panel.evaluate(() => window.todopop.snapshot())).settings.tint === tint,
    );
    let bubble;
    await until(() =>
      Boolean((bubble = app.windows().find((p) => p.url().includes('#bubble=colored')))),
    );
    await bubble.waitForSelector('.organic-art path');
    await bubble.waitForFunction(() => {
      const p = document.querySelector('.organic-art path');
      return (
        p &&
        /^#[0-9a-f]{6}$/i.test(p.getAttribute('fill') || '') &&
        getComputedStyle(p).fill !== 'rgb(0, 0, 0)'
      );
    });
    const paint = await bubble
      .locator('.organic-art path')
      .first()
      .evaluate((p) => ({
        fill: p.getAttribute('fill'),
        opacity: Number(p.getAttribute('fill-opacity')),
        computed: getComputedStyle(p).fill,
      }));
    assert.match(paint.fill, /^#[0-9a-f]{6}$/i);
    assert.ok(paint.opacity >= 0.14 && paint.opacity <= 0.28);
    assert.notEqual(paint.computed, 'rgb(0, 0, 0)');
  }
  checks.push(
    'slightly changed blue and Berry/Teal/Graphite tints all render valid translucent group colors, never fallback black',
  );
  await panel.getByRole('button', { name: 'Change color School', exact: true }).click();
  await panel.getByRole('button', { name: 'Custom group color', exact: true }).click();
  const groupHue = panel.getByRole('slider', { name: 'School hue', exact: true });
  assert.ok(Number.isFinite(Number(await groupHue.getAttribute('aria-valuenow'))));
  await groupHue.focus();
  await groupHue.press('ArrowRight');
  await until(
    async () =>
      (await panel.evaluate(() => window.todopop.snapshot())).groups.find((g) => g.id === 'School')
        .color.kind === 'wheel',
  );
  assert.ok(
    Number.isFinite(
      (await panel.evaluate(() => window.todopop.snapshot())).groups.find((g) => g.id === 'School')
        .color.h,
    ),
  );
  checks.push(
    'preset groups remain editable by ring after changing global Tint, without NaN colors',
  );
  const bubble = app.windows().find((p) => p.url().includes('#bubble=colored'));
  await panel.getByRole('textbox', { name: 'School HEX', exact: true }).fill('#c875db');
  await panel.getByRole('textbox', { name: 'School HEX', exact: true }).press('Enter');
  await until(
    async () =>
      (await bubble.locator('.organic-art path').first().getAttribute('fill')) === '#c875db',
  );
  assert.equal(await bubble.locator('.organic-art > g > path').count(), 1);
  assert.equal(await bubble.locator('.organic-art > g > use').count(), 4);
  await panel.evaluate(() => window.todopop.setSettings({ tint: '#1a419e' }));
  assert.equal(await bubble.locator('.organic-art path').first().getAttribute('fill'), '#c875db');
  checks.push(
    'Group HEX directly autofills bubble body at 14–28% opacity, glass layers follow the body; custom fill survives Tint changes',
  );

  await bubble.screenshot({
    path: 'docs/screenshots/tinted-bubble-fixed.png',
    omitBackground: true,
  });
  assert.deepEqual(errors, []);
  await writeFile(
    'docs/color-picker-ui-result.json',
    JSON.stringify({ passed: true, date: new Date().toISOString(), checks, errors }, null, 2) +
      '\n',
  );
  console.log(
    'PASS color picker: no native image dragging, no dock movement, all tinted bubble colors valid and translucent',
  );
} finally {
  await app?.close();
}
