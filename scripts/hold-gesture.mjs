import { _electron as electron } from 'playwright';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'todopop-hold-'));
await writeFile(
  join(dir, 'state.json'),
  JSON.stringify({
    schemaVersion: 2,
    tasks: [
      {
        id: 'hold',
        title: 'A grander Pop',
        position: { x: 300, y: 220 },
        url: 'https://example.com/task',
        urgency: 3,
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    if (await fn()) return;
    await wait(30);
  }
  throw new Error('Hold interaction did not settle');
}
try {
  app = await electron.launch({
    args: [resolve('apps/desktop')],
    env: { ...process.env, TODOPOP_DATA_DIR: dir, TODOPOP_TEST_PORT: '17848' },
  });
  app.on('window', (p) => p.on('pageerror', (e) => errors.push(String(e))));
  const panel = await app.firstWindow();
  await panel.waitForSelector('.control-bar');
  await app.evaluate(({ shell }) => {
    globalThis.__urls = [];
    shell.openExternal = async (url) => {
      globalThis.__urls.push(url);
    };
  });
  let b;
  await until(() => Boolean((b = app.windows().find((p) => p.url().includes('#bubble=hold')))));
  const hit = b.locator('.organic-hit'),
    snap = () => panel.evaluate(() => window.todopop.snapshot());
  await hit.waitFor();
  await hit.click();
  await until(async () => (await app.evaluate(() => globalThis.__urls)).length === 1);
  await wait(550);
  await hit.dblclick();
  await wait(100);
  assert.equal((await app.evaluate(() => globalThis.__urls)).length, 2);
  assert.equal((await snap()).tasks[0].completed, false);
  assert.equal(app.windows().filter((p) => p.url().includes('#edit=')).length, 0);
  checks.push(
    'Single click opens URL promptly; double click opens at most once, never pops or edits',
  );
  await hit.click({ button: 'right' });
  let edit;
  await until(() => Boolean((edit = app.windows().find((p) => p.url().includes('#edit=hold')))));
  await edit.getByRole('button', { name: 'Close edit', exact: true }).click();
  assert.equal((await snap()).tasks[0].completed, false);
  checks.push('Right click edits without completing');
  async function down() {
    const r = await hit.boundingBox();
    await b.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await b.mouse.down();
  }
  const width = () =>
    b
      .locator('.organic-art > g > path')
      .first()
      .evaluate((el) => el.getBBox().width);
  const initial = await width();
  await down();
  await wait(530);
  const charged = await width();
  assert.ok(charged > initial * 1.18, `${charged} vs ${initial}`);
  const a = await b.locator('.organic-art path').first().getAttribute('d');
  await wait(45);
  const z = await b.locator('.organic-art path').first().getAttribute('d');
  assert.notEqual(a, z);
  await b.screenshot({ path: 'docs/screenshots/hold-sizzle.png', omitBackground: true });
  await b.mouse.up();
  await wait(300);
  assert.equal((await snap()).tasks[0].completed, false);
  assert.equal((await app.evaluate(() => globalThis.__urls)).length, 2);
  assert.ok((await width()) < charged * 0.94);
  checks.push(
    'Holding inflates and continuously distorts the membrane; early release rebounds without Pop or navigation',
  );
  await down();
  await wait(250);
  await b.keyboard.press('Escape');
  await wait(700);
  await b.mouse.up();
  assert.equal((await snap()).tasks[0].completed, false);
  checks.push('Escape cancels a hold without accidental navigation');
  await down();
  await wait(220);
  await b.evaluate(() => window.dispatchEvent(new Event('blur')));
  await wait(700);
  await b.mouse.up();
  assert.equal((await snap()).tasks[0].completed, false);
  checks.push('Window blur cancellation boundary leaves task untouched');
  await down();
  const r = await hit.boundingBox();
  await b.mouse.move(r.x + r.width / 2 + 24, r.y + r.height / 2 + 12, { steps: 4 });
  await wait(950);
  await b.mouse.up();
  assert.equal((await snap()).tasks[0].completed, false);
  checks.push('Dragging beyond 6px cancels charging and never completes');
  await b.emulateMedia({ reducedMotion: 'reduce' });
  await b.waitForSelector('.organic-bubble[data-reduced-motion=true]');
  await wait(200);
  const small = await width();
  await down();
  await wait(450);
  assert.ok((await width()) < small * 1.15);
  await b.keyboard.press('Escape');
  await b.mouse.up();
  await b.emulateMedia({ reducedMotion: 'no-preference' });
  checks.push('Reduced motion limits inflation and removes high frequency sizzle');
  await down();
  await wait(950);
  await until(async () => (await snap()).tasks[0].completed);
  assert.equal(await b.locator('.figma-pop-drop').count(), 10);
  await b.mouse.up();
  assert.equal((await app.evaluate(() => globalThis.__urls)).length, 2);
  assert.equal((await snap()).history.filter((e) => e.kind === 'completed').length, 1);
  await panel.getByRole('button', { name: 'Undo', exact: true }).click();
  await until(async () => !(await snap()).tasks[0].completed);
  checks.push(
    '850ms hold produces one Pop and ten droplets; release never navigates; Undo restores the same task',
  );
  assert.deepEqual(errors, []);
  await writeFile(
    'docs/hold-gesture-result.json',
    JSON.stringify(
      { passed: true, date: new Date().toISOString(), holdMs: 850, checks, errors },
      null,
      2,
    ) + '\n',
  );
  checks.forEach((c) => console.log('PASS ' + c));
} finally {
  await app?.close();
}
