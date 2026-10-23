import { _electron as electron } from 'playwright';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'todopop-new-flow-'));
await writeFile(
  join(dir, 'state.json'),
  JSON.stringify({
    schemaVersion: 2,
    tasks: [
      {
        id: 'linked',
        title: 'Linked task',
        url: 'https://example.com/work',
        urgency: 4,
        completed: false,
        growthMs: 0,
        createdAt: Date.now(),
      },
      {
        id: 'local',
        title: 'Feed your pet',
        urgency: 3,
        completed: false,
        growthMs: 0,
        groupId: 'School',
        createdAt: Date.now(),
      },
    ],
    settings: { tint: '#1a419e', pauseIndefinite: true, pauseUntil: null, layoutSide: 'any' },
  }),
);
let desktop;
let inspectorRetries = 0;
const errors = [],
  checks = [];
const snap = (p) => p.evaluate(() => window.todopop.snapshot());
async function until(fn, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await fn()) return;
    } catch (e) {
      if (!String(e).includes('Resulting promise was garbage collected')) throw e;
      inspectorRetries++;
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  throw new Error(label);
}
function pass(label) {
  checks.push(label);
  console.log('PASS ' + label);
}
async function launch() {
  desktop = await electron.launch({
    args: [resolve('apps/desktop')],
    env: {
      ...process.env,
      TODOPOP_DATA_DIR: dir,
      TODOPOP_TEST_PORT: process.env.TODOPOP_TEST_PORT || '17848',
    },
  });
  desktop.on('window', (p) => p.on('pageerror', (e) => errors.push(String(e))));
  const p = await desktop.firstWindow();
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.waitForSelector('.control-panel');
  return p;
}
async function bubble(id) {
  await until(
    () => desktop.windows().some((p) => !p.isClosed() && p.url().includes(`#bubble=${id}`)),
    'bubble missing ' + id,
  );
  const p = desktop.windows().find((p) => !p.isClosed() && p.url().includes(`#bubble=${id}`));
  await p.waitForSelector('.organic-hit');
  return p;
}
const windowFor = (route) =>
  desktop.windows().find((p) => !p.isClosed() && p.url().includes(route));
try {
  let panel = await launch();
  await panel.getByRole('button', { name: 'Try it', exact: true }).click();
  await panel.getByRole('button', { name: 'Practice bubble', exact: true }).click();
  await panel.getByRole('button', { name: 'Back · task stays', exact: true }).click();
  await panel.getByRole('button', { name: 'Practice bubble', exact: true }).dblclick();
  await panel.getByRole('button', { name: 'Save practice edit', exact: true }).click();
  await panel
    .getByRole('button', { name: 'Practice bubble', exact: true })
    .click({ button: 'right' });
  await panel.getByRole('button', { name: 'Start bubbling', exact: true }).click();
  assert.equal((await snap(panel)).tasks.length, 2);
  assert.equal((await snap(panel)).settings.tutorialDone, true);
  assert.equal((await snap(panel)).settings.pauseIndefinite, false);
  assert.equal(await panel.getByRole('button', { name: /Pause growing/ }).count(), 0);
  pass(
    'tutorial rehearses click/double/right click without modifying real tasks; old pause migrated',
  );
  const nativePanel = await desktop.browserWindow(panel);
  const bar = await nativePanel.evaluate((w) => ({ b: w.getBounds(), movable: w.isMovable() }));
  assert.equal(bar.movable, true);
  await panel.getByRole('button', { name: 'Blow a bubble', exact: true }).click();
  await panel.locator('input[name=title]').fill('Offline reminder');
  await panel.getByRole('button', { name: 'Blow it', exact: true }).click();
  const local = (await snap(panel)).tasks.find((t) => t.title === 'Offline reminder');
  assert.ok(local);
  assert.equal((await nativePanel.evaluate((w) => w.getBounds())).y, bar.b.y);
  pass('first logo O creates tasks from movable compact control bar');
  const b = await bubble(local.id);
  assert.equal(await b.locator('.bubble-tools').count(), 0);
  assert.equal(await b.getByRole('button', { name: 'Complete task', exact: true }).count(), 0);
  await b.getByRole('button', { name: `Open ${local.title}`, exact: true }).click();
  await until(() => Boolean(windowFor(`#billboard=${local.id}`)), 'no local billboard');
  let billboard = windowFor(`#billboard=${local.id}`);
  await billboard.getByRole('heading', { name: local.title, exact: true }).waitFor();
  assert.equal((await snap(panel)).billboardId, local.id);
  assert.equal((await snap(panel)).tasks.find((t) => t.id === local.id).completed, false);
  const size = (await snap(panel)).tasks.find((t) => t.id === 'local').growthMs;
  await billboard.waitForTimeout(1200);
  assert.equal((await snap(panel)).tasks.find((t) => t.id === 'local').growthMs, size);
  await billboard.screenshot({ path: 'docs/screenshots/billboard.png', omitBackground: true });
  await billboard.keyboard.press('Escape').catch((e) => {
    if (!billboard.isClosed()) throw e;
  });
  await until(async () => (await snap(panel)).billboardId === null, 'Esc did not return');
  assert.equal((await snap(panel)).tasks.find((t) => t.id === local.id).completed, false);
  pass(
    'single click enters Chrome-independent billboard; growth stops; Esc returns without completing',
  );
  const linked = await bubble('linked');
  await desktop.evaluate(({ shell }) => {
    globalThis.__opened = [];
    shell.openExternal = (url) => {
      globalThis.__opened.push(url);
    };
  });
  await linked.getByRole('button', { name: 'Open Linked task', exact: true }).dblclick();
  await until(() => Boolean(windowFor('#edit=linked')), 'double click did not edit');
  let editor = windowFor('#edit=linked');
  await editor.locator('input[name=title]').waitFor();
  assert.deepEqual(await desktop.evaluate(() => globalThis.__opened), []);
  await editor.locator('input[name=title]').fill('Edited linked task');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await until(
    async () =>
      (await snap(panel)).tasks.find((t) => t.id === 'linked').title === 'Edited linked task',
    'edit not saved',
  );
  pass('double click edits existing fields without firing first-click URL navigation');
  await linked.getByRole('button', { name: 'Open Edited linked task', exact: true }).click();
  await until(
    async () => (await desktop.evaluate(() => globalThis.__opened)).length === 1,
    'single linked click failed',
  );
  assert.equal((await snap(panel)).tasks.find((t) => t.id === 'linked').completed, false);
  pass('linked single click opens URL without completing');
  await linked
    .getByRole('button', { name: 'Open Edited linked task', exact: true })
    .click({ button: 'right' });
  await until(
    async () => (await snap(panel)).tasks.find((t) => t.id === 'linked').completed,
    'right click failed',
  );
  assert.equal(await linked.locator('.figma-pop-drop').count(), 10);
  await panel.getByRole('button', { name: 'Undo', exact: true }).click();
  await until(
    async () => (await snap(panel)).tasks.find((t) => t.id === 'linked').completed === false,
    'Undo failed',
  );
  assert.equal(
    (await snap(panel)).history.filter((e) => e.taskId === 'linked' && e.kind === 'completed')
      .length,
    0,
  );
  await until(() => !linked.isClosed(), 'old pop still closing', 1000).catch(() => {});
  pass(
    'right click completes with ten Figma droplets; immediate Undo restores same round and history',
  );
  await panel.evaluate(() =>
    window.todopop.create({ title: 'Group companion', urgency: 3, groupId: 'School' }),
  );
  await panel.getByRole('button', { name: 'Tint and groups', exact: true }).click();
  const hue = panel.getByRole('slider', { name: 'Tint hue', exact: true });
  await hue.focus();
  await hue.press('ArrowRight');
  await until(async () => (await snap(panel)).settings.tint !== '#1a419e', 'hue not saved');
  await panel.getByRole('slider', { name: 'Tint saturation', exact: true }).fill('55');
  await panel.getByRole('slider', { name: 'Tint saturation', exact: true }).press('ArrowRight');
  await panel.getByRole('textbox', { name: 'Tint HEX', exact: true }).fill('#FFFFFF');
  await panel.getByRole('textbox', { name: 'Tint HEX', exact: true }).press('Enter');
  await panel.waitForFunction(
    () =>
      getComputedStyle(document.documentElement).getPropertyValue('--tint').trim() === '#ffffff',
  );
  assert.notEqual(
    await panel.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
    ),
    '#ffffff',
  );
  await panel.getByRole('button', { name: 'Tint Ink Blue', exact: true }).click();
  await panel.getByRole('button', { name: /School Anywhere/ }).click();
  await panel.getByRole('textbox', { name: 'School HEX', exact: true }).fill('#123456');
  await panel.getByRole('textbox', { name: 'School HEX', exact: true }).press('Enter');
  await until(
    async () => (await snap(panel)).groups.find((g) => g.id === 'School').color.hex === '#123456',
    'group color failed',
  );
  assert.equal((await snap(panel)).selectedGroupId, 'School');
  const unselected = await bubble('linked');
  await unselected.waitForFunction(
    () => Number(getComputedStyle(document.querySelector('.organic-bubble')).opacity) <= 0.39,
  );
  await panel.screenshot({
    path: 'docs/screenshots/ring-group-picker.png',
    omitBackground: true,
    animations: 'disabled',
  });
  pass(
    'third O exposes original ring/saturation controls; custom group colors persist and other groups fade',
  );
  const before = (await snap(panel)).tasks.find((t) => t.id === 'local').position;
  const companionBefore = (await snap(panel)).tasks.find(
    (t) => t.title === 'Group companion',
  ).position;
  const handle = panel.getByRole('button', { name: 'Move group School', exact: true });
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  await panel.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await panel.mouse.down();
  await panel.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 8 });
  await panel.mouse.up();
  await until(async () => {
    const p = (await snap(panel)).tasks.find((t) => t.id === 'local').position;
    return (
      Math.hypot(p.x - before.x, p.y - before.y) > 10 &&
      (await snap(panel)).groups.find((g) => g.id === 'School').positionLocked
    );
  }, 'group move did not persist');
  const movedState = await snap(panel),
    movedLocal = movedState.tasks.find((t) => t.id === 'local').position,
    movedCompanion = movedState.tasks.find((t) => t.title === 'Group companion').position;
  assert.ok(Math.abs(movedLocal.x - before.x - (movedCompanion.x - companionBefore.x)) <= 2);
  assert.ok(Math.abs(movedLocal.y - before.y - (movedCompanion.y - companionBefore.y)) <= 2);
  assert.equal(movedState.groups.find((g) => g.id === 'School').positionLocked, true);
  await panel.keyboard.press('Escape');
  assert.equal((await snap(panel)).selectedGroupId, null);
  pass('selected group moves through dedicated handle and Esc clears highlight');
  await panel.getByRole('button', { name: 'Popped bubbles', exact: true }).click();
  await panel.getByRole('region', { name: 'Popped receipt' }).waitFor();
  assert.equal(await panel.getByRole('slider', { name: 'Tint hue', exact: true }).count(), 0);
  pass('second O switches to receipt, rather than opening all three panels');
  await panel.evaluate((id) => window.todopop.open(id), local.id);
  await until(() => Boolean(windowFor(`#billboard=${local.id}`)), 'billboard reopen failed');
  billboard = windowFor(`#billboard=${local.id}`);
  await billboard.getByRole('button', { name: 'Pop · Done', exact: true }).click();
  await until(
    async () => (await snap(panel)).billboardId === null,
    'completion did not leave focus',
  );
  assert.equal((await snap(panel)).tasks.find((t) => t.id === local.id).completed, true);
  pass('billboard completion closes local session and records task once');
  const saved = await snap(panel);
  await desktop.close();
  desktop = null;
  panel = await launch();
  const restored = await snap(panel);
  assert.equal(restored.settings.tutorialDone, true);
  assert.equal(restored.billboardId, null);
  assert.equal(restored.groups.find((g) => g.id === 'School').color.hex, '#123456');
  assert.equal(restored.groups.find((g) => g.id === 'School').positionLocked, true);
  assert.equal(restored.tasks.find((t) => t.id === local.id).completed, true);
  assert.ok(restored.history.some((e) => e.taskId === local.id && e.kind === 'completed'));
  assert.equal(await panel.getByRole('button', { name: 'Try it', exact: true }).count(), 0);
  pass(
    'restart retains edits, group color, completion and tutorial state without reopening billboard',
  );
  await panel.getByRole('button', { name: 'Blow a bubble', exact: true }).click();
  await panel.locator('input[name=title]').fill('Draft to keep');
  await panel.getByRole('button', { name: '+ New', exact: true }).click();
  await panel.getByRole('button', { name: 'Blow a bubble', exact: true }).click();
  assert.equal(await panel.locator('input[name=title]').inputValue(), 'Draft to keep');
  assert.deepEqual(errors, []);
  await panel.screenshot({
    path: 'docs/screenshots/fixed-control-panel.png',
    omitBackground: true,
    animations: 'disabled',
  });
  pass('new task draft survives group management; renderer has no errors');
  await writeFile(
    'docs/desktop-acceptance-result.json',
    JSON.stringify(
      {
        passed: true,
        date: new Date().toISOString(),
        isolatedUserData: true,
        inspectorRetries,
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await desktop?.close();
}
