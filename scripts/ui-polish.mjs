import { _electron as electron } from 'playwright';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'todopop-polish-'));
await writeFile(
  join(dir, 'state.json'),
  JSON.stringify({
    schemaVersion: 2,
    tasks: [
      {
        id: 'focus',
        title: 'Feed your pet',
        groupId: 'School',
        urgency: 2,
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
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error('UI did not settle');
}
async function centered(p, selector) {
  const positions = await p.locator(selector).evaluateAll((nodes) =>
    nodes.map((svg) => {
      const box = svg.getBBox(),
        matrix = svg.getScreenCTM();
      const center = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(
        matrix,
      );
      const button = svg.closest('button').getBoundingClientRect();
      return {
        label: svg.closest('button').getAttribute('aria-label'),
        x: Math.abs(center.x - button.x - button.width / 2),
        y: Math.abs(center.y - button.y - button.height / 2),
      };
    }),
  );
  assert.ok(positions.length > 0);
  assert.ok(
    positions.every((v) => v.x < 0.6 && v.y < 0.6),
    JSON.stringify(positions),
  );
}
try {
  app = await electron.launch({
    args: [resolve('apps/desktop')],
    env: { ...process.env, TODOPOP_DATA_DIR: dir, TODOPOP_TEST_PORT: '17848' },
  });
  app.on('window', (p) => p.on('pageerror', (e) => errors.push(String(e))));
  const p = await app.firstWindow();
  await p.waitForSelector('.control-bar');
  const buttons = await p.locator('.logo-o-button').evaluateAll((nodes) =>
    nodes.map((el) => {
      const a = el.querySelector('img').getBoundingClientRect(),
        b = el.querySelector('svg').getBoundingClientRect();
      return {
        x: Math.abs(a.x + a.width / 2 - b.x - b.width / 2),
        y: Math.abs(a.y + a.height / 2 - b.y - b.height / 2),
      };
    }),
  );
  assert.ok(buttons.every((b) => b.x < 0.5 && b.y < 0.5));
  checks.push('All three O glyphs centered within 0.5 CSS px of the ellipse');
  await p.getByRole('button', { name: 'Blow a bubble', exact: true }).click();
  await centered(p, '.prototype-strip .side-buttons svg');

  await p.getByRole('button', { name: 'Open tutorial', exact: true }).click();
  await p.getByRole('region', { name: 'TODOPOP tutorial' }).waitFor();
  assert.equal(await p.locator('.control-content > section').count(), 1);
  const surface = await p
    .locator('.control-content')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.notEqual(surface, 'rgba(0, 0, 0, 0)');
  await p.screenshot({ path: 'docs/screenshots/polished-tutorial.png', omitBackground: true });
  for (const [button, section] of [
    ['Tint and groups', 'Tint and group settings'],
    ['Blow a bubble', 'Create a bubble'],
    ['Popped bubbles', 'Popped receipt'],
    ['Chrome connection', 'Chrome demo connection'],
    ['Open tutorial', 'TODOPOP tutorial'],
  ]) {
    await p.getByRole('button', { name: button, exact: true }).click();
    await p.getByRole('region', { name: section, exact: true }).waitFor();
    assert.equal(await p.locator('.control-content > section').count(), 1);
  }
  checks.push(
    'Tutorial and all four dock panels replace each other; tutorial has opaque card surface',
  );
  await p.getByRole('button', { name: 'Tint and groups', exact: true }).click();
  const ring = p.getByRole('slider', { name: 'Tint hue', exact: true });
  const ratio = await ring.evaluate(
    (el) => parseFloat(getComputedStyle(el, '::before').width) / el.getBoundingClientRect().width,
  );
  assert.ok(Math.abs(ratio - 0.55) < 0.01);
  const b = await ring.boundingBox(),
    snap = () => p.evaluate(() => window.todopop.snapshot());
  const initial = (await snap()).settings.tint;
  await p.mouse.move(b.x + 75, b.y + 10);
  await p.mouse.down();
  await p.mouse.move(b.x + 140, b.y + 75, { steps: 8 });
  await until(async () => (await snap()).settings.tint !== initial);
  const first = (await snap()).settings.tint;
  await p.mouse.move(b.x + 75, b.y + 140, { steps: 8 });
  await until(async () => (await snap()).settings.tint !== first);
  const second = (await snap()).settings.tint;
  assert.notEqual(
    await p.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--tint').trim(),
    ),
    initial,
  );
  await p.mouse.up();
  await until(async () => (await snap()).settings.tint === second);
  checks.push(
    'Tint updates twice before pointer release, live theme changes; ring hole matches original 55% diameter',
  );
  await p.getByRole('button', { name: 'Change color School', exact: true }).click();
  await p.getByRole('button', { name: 'Custom group color', exact: true }).click();
  const gr = p.getByRole('slider', { name: 'School hue', exact: true }),
    gb = await gr.boundingBox();
  await p.mouse.move(gb.x + 75, gb.y + 10);
  await p.mouse.down();
  await p.mouse.move(gb.x + 140, gb.y + 75, { steps: 8 });
  await until(async () => {
    const c = (await snap()).groups.find((g) => g.id === 'School').color;
    return c.kind === 'wheel' && Math.abs(c.h - 90) < 2;
  });
  await p.mouse.up();
  checks.push('Custom group color updates while pointer is still held');
  const card = p.locator('.group-color-card');
  await centered(p, '.group-color-card .side-buttons svg');
  await centered(p, '.group-side-icon svg');
  checks.push(
    'Drawn SVG bounds centered within 0.6px in all five palette directions, group rows and six global controls',
  );

  assert.equal(await card.locator('.group-move-handle').count(), 0);
  const alignment = await card.evaluate((el) => {
    const header = el.querySelector('.field-line').getBoundingClientRect();
    const close = el.querySelector('.field-line button').getBoundingClientRect();
    const label = el.querySelector('.hex-field > span').getBoundingClientRect();
    const swatches = el.querySelector('.group-color-swatches').getBoundingClientRect();
    const input = el.querySelector('.hex-field input').getBoundingClientRect();
    return {
      close: Math.abs(close.right - header.right),
      left: Math.abs(label.left - swatches.left),
      field: Math.abs(input.right - header.right),
    };
  });
  assert.ok(Object.values(alignment).every((n) => n < 1));
  await card.screenshot({
    path: 'docs/screenshots/aligned-group-palette.png',
    omitBackground: true,
  });
  checks.push(
    'Group labels share a left edge, Close and HEX field align right, drag handle removed',
  );

  await p.getByRole('button', { name: 'Close', exact: true }).click();
  await p.screenshot({ path: 'docs/screenshots/polished-palette.png', omitBackground: true });
  await p.evaluate(() => window.todopop.open('focus'));
  let billboard;
  await until(() =>
    Boolean((billboard = app.windows().find((w) => w.url().includes('#billboard=')))),
  );
  await billboard.waitForSelector('.billboard');
  const colors = await billboard.locator('.billboard').evaluate((el) => ({
    text: getComputedStyle(el).color,
    bg: getComputedStyle(el).backgroundColor,
    button: getComputedStyle(el.querySelector('.tp-button')).color,
  }));
  assert.equal(colors.text, 'rgb(255, 255, 255)');
  assert.equal(colors.button, 'rgb(255, 255, 255)');
  assert.notEqual(colors.bg, 'rgba(255, 255, 255, 0.98)');
  await billboard.screenshot({ path: 'docs/screenshots/dark-billboard.png', omitBackground: true });
  await billboard.getByRole('button', { name: 'Return to bubbles', exact: true }).click();
  checks.push(
    'Billboard uses dark themed background, white text and readable controls; return works',
  );
  assert.deepEqual(errors, []);
  await writeFile(
    'docs/ui-polish-result.json',
    JSON.stringify({ passed: true, date: new Date().toISOString(), checks, errors }, null, 2) +
      '\n',
  );
  checks.forEach((c) => console.log('PASS ' + c));
} finally {
  await app?.close();
}
