import { _electron as electron } from 'playwright';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'todopop-feedback-'));
await writeFile(
  join(dir, 'state.json'),
  JSON.stringify({
    schemaVersion: 2,
    tasks: [0, 1, 2, 3].map((i) => ({
      id: String(i),
      title: 'Growing ' + i,
      snoozedUntil: i === 0 ? Date.now() + 600000 : undefined,
      url: i === 0 ? 'https://example.com/work' : undefined,
      urgency: i === 3 ? 1 : 4,
      growthMs: i === 3 ? 0 : 220000 + i * 160000,
      groupId: i % 2 ? 'Work' : 'School',
      completed: false,
      createdAt: Date.now(),
    })),
    settings: { tutorialDone: true, interactionVersion: 2 },
  }),
);
let app;
const checks = [],
  errors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  const end = Date.now() + 12000;
  while (Date.now() < end) {
    if (await fn()) return;
    await wait(30);
  }
  throw new Error('Feedback regression did not settle');
}
function contrast(a, b) {
  const lum = (s) => {
    const c = s
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((n) => n / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
try {
  app = await electron.launch({
    args: [resolve('apps/desktop')],
    env: { ...process.env, TODOPOP_DATA_DIR: dir, TODOPOP_TEST_PORT: '17848' },
  });
  app.on('window', (p) => p.on('pageerror', (e) => errors.push(String(e))));
  const p = await app.firstWindow();
  await p.waitForSelector('.control-bar');
  const snap = () => p.evaluate(() => window.todopop.snapshot());
  let b;
  await until(() => Boolean((b = app.windows().find((w) => w.url().includes('#bubble=0')))));
  await b.waitForSelector('.organic-hit');
  await b.locator('.organic-hit').click({ button: 'right' });
  let edit;
  await until(() => Boolean((edit = app.windows().find((w) => w.url().includes('#edit=0')))));
  await edit.locator('input[name=title]').waitFor();
  await edit.getByRole('button', { name: 'Work', exact: true }).click();
  assert.equal(await edit.getByRole('button',{name:'Work',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal((await snap()).selectedGroupId,null);
  assert.equal(await edit.getByRole('alert').count(), 0);
  await edit.getByRole('button', { name: 'Edit groups', exact: true }).click();
  await edit.getByRole('button', { name: '+ Add a group', exact: true }).click();
  await until(async () => (await snap()).groups.some((g) => g.name === 'New group'));
  await edit
    .getByRole('textbox', { name: 'Group name New group', exact: true })
    .fill('From editor');
  await edit.getByRole('textbox', { name: 'Group name New group', exact: true }).press('Enter');
  await until(async () => (await snap()).groups.some((g) => g.name === 'From editor'));
  await edit.getByRole('button', { name: 'Done', exact: true }).click();
  await edit.getByRole('button', { name: 'From editor', exact: true }).click();
  await edit.locator('input[name=title]').fill('Edited safely');
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await until(async () => (await snap()).tasks[0].title === 'Edited safely');
  assert.equal(
    (await snap()).tasks[0].groupId,
    (await snap()).groups.find((g) => g.name === 'From editor').id,
  );
  checks.push(
    'Actual right-click editor selects, creates and renames groups then saves without Untrusted window',
  );
  await p.evaluate(() => window.todopop.edit('0'));
  await until(() =>
    Boolean((edit = app.windows().find((w) => !w.isClosed() && w.url().includes('#edit=0')))),
  );
  await edit.waitForSelector('.edit-panel');
  const denied = await edit.evaluate(async () => {
    const out = [];
    for (const action of [
      () => window.todopop.update('1', { title: 'Not allowed', urgency: 4 }),
      () => window.todopop.setSettings({ tint: '#ffffff' }),
    ]) {
      try {
        await action();
        out.push(false);
      } catch (e) {
        out.push(String(e).includes('Untrusted window'));
      }
    }
    return out;
  });
  assert.deepEqual(denied, [true, true]);
  assert.equal(
    await b.evaluate(async () => {
      try {
        await window.todopop.groups('create', { name: 'Spoof' });
        return false;
      } catch (e) {
        return String(e).includes('Untrusted window');
      }
    }),
    true,
  );
  await edit.getByRole('button', { name: 'Close edit', exact: true }).click();
  checks.push('Editor cannot edit another task or settings; bubble renderer cannot mutate groups');
  assert.equal(await p.locator('.clear-selection').count(), 0);
  await p.keyboard.press('Escape');
  assert.equal((await snap()).selectedGroupId, null);
  const toast = await p.getByRole('status').evaluate((el) => ({
    fg: getComputedStyle(el).color,
    bg: getComputedStyle(el).backgroundColor,
  }));
  assert.ok(contrast(toast.fg, toast.bg) >= 4.5);
  checks.push('Selection banner removed, Esc clears highlight and toast contrast meets 4.5:1');
  await p.getByRole('button', { name: 'Chrome connection', exact: true }).click();
  assert.equal(
    await p.getByText('Demo only · copy this code into the extension.', { exact: true }).count(),
    0,
  );
  await p.getByRole('button', { name: 'Chrome connection', exact: true }).click();
  const opacity = await b.locator('.organic-art > g > path').first().getAttribute('fill-opacity');
  assert.ok(Number(opacity) >= 0.14 && Number(opacity) <= 0.28);
  checks.push(
    'Chrome connection demo line removed; bubble group autofill is more translucent (14–28%)',
  );
  let prior = await snap();
  let stableReads = 0;
  for (let i = 0; i < 24; i++) {
    const next = await snap();
    if (
      next.tasks.every((t, j) => t.size === prior.tasks[j].size) &&
      JSON.stringify(next.obstacles) === JSON.stringify(prior.obstacles)
    ) {
      assert.deepEqual(
        next.tasks.map((t) => t.position),
        prior.tasks.map((t) => t.position),
      );
      stableReads++;
    }
    prior = next;
  }
  assert.ok(stableReads > 10);
  checks.push('Repeated snapshots with unchanged geometry never move bubbles');
  await p.evaluate(() => window.todopop.growthMode('demo'));
  prior = await snap();
  let grew = false,
    maxStep = 0;
  for (let i = 0; i < 65; i++) {
    await wait(50);
    const next = await snap();
    for (let j = 0; j < next.tasks.length; j++) {
      const t = next.tasks[j],
        old = prior.tasks[j],
        change = Math.abs(t.size - old.size);
      const step = Math.hypot(
        t.position.x + t.size / 2 - old.position.x - old.size / 2,
        t.position.y + t.size / 2 - old.position.y - old.size / 2,
      );
      assert.ok(
        step <= Math.max(1, change * 0.7) + 1.5,
        `${t.id} jumped ${step}px for ${change}px growth`,
      );
      maxStep = Math.max(maxStep, step);
      if (t.size > old.size) grew = true;
    }
    prior = next;
  }
  assert.equal(grew, true);
  checks.push(
    'Crowded 60x growing bubbles move locally without teleporting or snapshot-induced oscillation',
  );
  await p.screenshot({ path: 'docs/screenshots/readable-notification.png', omitBackground: true });
  assert.deepEqual(errors, []);
  await writeFile(
    'docs/feedback-regression-result.json',
    JSON.stringify(
      { passed: true, date: new Date().toISOString(), checks, maxStep, errors },
      null,
      2,
    ) + '\n',
  );
  checks.forEach((c) => console.log('PASS ' + c));
} finally {
  await app?.close();
}
