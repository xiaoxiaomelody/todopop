import { _electron as electron } from 'playwright';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'todopop-designer-'));
await writeFile(
  join(dir, 'state.json'),
  JSON.stringify({
    schemaVersion: 2,
    tasks: [
      {
        id: 'school',
        title: 'Reply to Melody',
        groupId: 'School',
        urgency: 3,
        completed: false,
        createdAt: Date.now(),
      },
      {
        id: 'work',
        title: 'Problem set 4',
        groupId: 'Work',
        urgency: 4,
        completed: false,
        createdAt: Date.now(),
      },
    ],
    settings: { tutorialDone: true, interactionVersion: 1 },
  }),
);
let app;
const checks = [],
  errors = [];
const snap = (p) => p.evaluate(() => window.todopop.snapshot());
async function until(fn) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 80));
  }
  throw new Error('Designer iteration state did not settle');
}
function pass(s) {
  checks.push(s);
  console.log('PASS ' + s);
}
try {
  app = await electron.launch({
    args: [resolve('apps/desktop')],
    env: { ...process.env, TODOPOP_DATA_DIR: dir, TODOPOP_TEST_PORT: '17848' },
  });
  app.on('window', (p) => p.on('pageerror', (e) => errors.push(String(e))));
  const p = await app.firstWindow();
  await p.waitForSelector('.control-panel');
  await p.getByRole('button', { name: 'Blow a bubble', exact: true }).click();
  await p.getByRole('slider', { name: 'Urgency, 1 to 4', exact: true }).fill('3');
  assert.equal(await p.locator('input[name=url]').isVisible(), false);
  await p.getByRole('button', { name: 'Edit groups', exact: true }).click();
  await p.getByRole('button', { name: '+ Add a group', exact: true }).click();
  await until(async () => (await snap(p)).groups.length === 4);
  await p.screenshot({ path: 'docs/screenshots/designer-blow-panel.png', omitBackground: true });
  pass(
    'designer form: real slider, inline editable groups, add, optional Link and plain oval dock',
  );
  await p.getByRole('button', { name: 'Position School: any', exact: true }).click();
  await until(async () => (await snap(p)).groups.find((g) => g.id === 'School').side === 'left');
  await p.getByRole('button', { name: 'Change color Work', exact: true }).click();
  await p.getByRole('button', { name: 'Set Work right', exact: true }).click();
  await p.getByRole('button', { name: 'Close', exact: true }).click();
  const area = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().workArea);
  await until(async () => {
    const s = await snap(p),
      a = s.tasks.find((t) => t.id === 'school'),
      b = s.tasks.find((t) => t.id === 'work');
    return (
      a.position.x + a.size / 2 < area.x + 200 &&
      b.position.x + b.size / 2 > area.x + area.width - 220
    );
  });
  pass('per-group School left / Work right applies independently');
  await p.getByRole('button', { name: 'Line up all left', exact: true }).click();
  await until(async () => (await snap(p)).settings.layoutSide === 'left');
  assert.equal((await snap(p)).groups.find((g) => g.id === 'Work').side, 'right');
  assert.ok((await snap(p)).tasks.every((t) => t.position.x + t.size / 2 < area.x + 220));
  await p.getByRole('button', { name: 'Line up all right', exact: true }).click();
  await p.evaluate(() =>
    window.todopop.create({ title: 'New edge task', urgency: 2, groupId: 'School' }),
  );
  await until(async () =>
    (await snap(p)).tasks.every((t) => t.position.x + t.size / 2 > area.x + area.width - 220),
  );
  await p.getByRole('button', { name: 'Arrange by group', exact: true }).click();
  await until(async () => {
    const s = await snap(p);
    return (
      s.tasks.find((t) => t.id === 'work').position.x +
        s.tasks.find((t) => t.id === 'work').size / 2 >
        area.x + area.width - 220 &&
      s.tasks
        .filter((t) => t.groupId === 'School')
        .every((t) => t.position.x + t.size / 2 < area.x + 220)
    );
  });
  pass('global overrides all groups and new tasks, then by-group restores saved sides');
  await p.getByRole('button', { name: 'Tint and groups', exact: true }).click();
  await p.getByRole('slider', { name: 'Tint hue', exact: true }).focus();
  await p.getByRole('slider', { name: 'Tint hue', exact: true }).press('ArrowRight');
  await until(async () => Boolean((await snap(p)).settings.tintWheel));
  await p.getByRole('button', { name: 'Change color School', exact: true }).click();
  await p.getByRole('button', { name: 'Custom group color', exact: true }).click();
  await p.getByRole('slider', { name: 'School hue', exact: true }).focus();
  await p.getByRole('slider', { name: 'School hue', exact: true }).press('ArrowRight');
  await until(
    async () => (await snap(p)).groups.find((g) => g.id === 'School').color.kind === 'wheel',
  );
  const custom = JSON.stringify((await snap(p)).groups.find((g) => g.id === 'School').color);
  await p.getByRole('button', { name: 'Tint Berry', exact: true }).click();
  assert.equal(JSON.stringify((await snap(p)).groups.find((g) => g.id === 'School').color), custom);
  await p.screenshot({ path: 'docs/screenshots/designer-tint-group.png', omitBackground: true });
  pass('designer dynamic Tint + OKLCH group wheel, custom group unaffected by theme');
  const b = app.windows().find((p) => p.url().includes('#bubble=work'));
  await b.waitForFunction(() =>
    document.querySelector('.organic-art path')?.getAttribute('d')?.includes('Q'),
  );
  const before = await b.locator('.organic-art path').first().getAttribute('d');
  await b.waitForTimeout(200);
  assert.notEqual(await b.locator('.organic-art path').first().getAttribute('d'), before);
  assert.ok(
    (await b.locator('.organic-hit').evaluate((e) => getComputedStyle(e).clipPath)).startsWith(
      'path(',
    ),
  );
  await until(
    async () => ((await snap(p)).tasks.find((t) => t.id === 'work').contour?.length || 0) === 80,
  );
  await b.screenshot({ path: 'docs/screenshots/designer-membrane.png', omitBackground: true });
  pass(
    'live membrane has smooth changing curves, matching path hit area and reported coverage contour',
  );
  assert.deepEqual(errors, []);
  await app.close();
  app = null;
  app = await electron.launch({
    args: [resolve('apps/desktop')],
    env: { ...process.env, TODOPOP_DATA_DIR: dir, TODOPOP_TEST_PORT: '17848' },
  });
  const again = await app.firstWindow();
  await again.waitForSelector('.control-panel');
  const restored = await snap(again);
  assert.equal(restored.groups.find((g) => g.id === 'School').side, 'left');
  assert.equal(restored.groups.find((g) => g.id === 'Work').side, 'right');
  assert.equal(JSON.stringify(restored.groups.find((g) => g.id === 'School').color), custom);
  pass('restart retains group sides and custom designer color');
  await writeFile(
    'docs/designer-iteration-result.json',
    JSON.stringify({ passed: true, date: new Date().toISOString(), checks, errors }, null, 2) +
      '\n',
  );
} finally {
  await app?.close();
}
