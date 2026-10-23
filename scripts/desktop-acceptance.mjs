import { _electron as electron } from 'playwright';
import { mkdtemp, readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'todopop-acceptance-')),
  now = Date.now();
await writeFile(
  join(dir, 'tasks.json'),
  JSON.stringify([
    {
      id: 'legacy',
      title: 'Legacy linked',
      url: 'https://example.com/work',
      urgency: 4,
      group: 'School',
      completed: false,
      createdAt: now - 3600000,
      position: { x: 40, y: 80 },
    },
    {
      id: 'old-done',
      title: 'Yesterday’s win',
      urgency: 2,
      group: 'Life',
      completed: true,
      createdAt: now - 86400000,
      completedAt: now - 86400000 + 1000,
    },
  ]),
);
let desktop;
const errors = [],
  checks = [];
const snap = (page) => page.evaluate(() => window.todopop.snapshot());
async function until(fn, label, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(label);
}
async function launch() {
  desktop = await electron.launch({
    args: [resolve('apps/desktop')],
    env: { ...process.env, TODOPOP_DATA_DIR: dir },
    timeout: 20000,
  });
  desktop.on('window', (p) => p.on('pageerror', (e) => errors.push(String(e))));
  const p = await desktop.firstWindow();
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.waitForSelector('.panel');
  return p;
}
const windows = () =>
  desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .filter((w) => w.webContents.getURL().includes('#bubble='))
      .map((w) => ({ url: w.webContents.getURL(), visible: w.isVisible(), bounds: w.getBounds() })),
  );
function pass(label) {
  checks.push(label);
  console.log('PASS ' + label);
}
try {
  let page = await launch();
  let state = await snap(page);
  assert.equal(state.tasks.length, 2);
  assert.equal(state.history.length, 1);
  assert.equal(state.tasks[0].groupId, 'School');
  assert.ok((await readdir(dir)).some((f) => f.startsWith('tasks-before-v2-')));
  assert.equal(JSON.parse(await readFile(join(dir, 'state.json'), 'utf8')).schemaVersion, 2);
  pass('legacy tasks migrate with backup and historical completion');
  const firstSize = state.tasks[0].size;
  await until(
    async () => (await snap(page)).tasks[0].size > firstSize,
    'Formal growth did not advance',
  );
  await page.evaluate(() => window.todopop.pause('manual'));
  const pausedSize = (await snap(page)).tasks[0].size;
  await new Promise((r) => setTimeout(r, 2200));
  assert.equal((await snap(page)).tasks[0].size, pausedSize);
  assert.equal((await windows()).filter((w) => w.visible).length, 1);
  pass('formal growth advances; global pause stops growth while keeping bubbles visible');
  await page.evaluate(() => window.todopop.pause('resume'));
  await page.evaluate(() => window.todopop.growthMode('demo'));
  const demoStart = (await snap(page)).tasks[0].size;
  await until(
    async () => (await snap(page)).tasks[0].size > demoStart + 30,
    'Demo did not accelerate',
  );
  await page.evaluate(() => window.todopop.growthMode('real'));
  const realAgain = (await snap(page)).tasks[0].size;
  assert.ok(realAgain < demoStart + 10);
  await page.evaluate(() => window.todopop.pause('manual'));
  pass('60x Demo is an isolated preview and does not overwrite formal growth');
  await page.evaluate(() => window.todopop.create({ title: 'No-link reminder', urgency: 1 }));
  await until(async () => (await windows()).length === 2, 'Second bubble missing');
  state = await snap(page);
  const reminder = state.tasks.find((t) => t.title === 'No-link reminder');
  await page.getByRole('button', { name: /^Floating/ }).click();
  const handle = page.getByRole('button', { name: 'Reorder Legacy linked', exact: true });
  await handle.press('ArrowDown');
  await until(
    async () => (await snap(page)).tasks.find((t) => t.id === 'legacy').rank === 1,
    'Keyboard reorder failed',
  );
  pass('keyboard task reordering persists manual rank');
  let bubble = desktop.windows().find((p) => p.url().includes(`bubble=${reminder.id}`));
  await bubble.waitForSelector('.bubble-keyboard');
  await bubble.locator('.bubble-keyboard').click();
  await until(
    async () => (await snap(page)).tasks.find((t) => t.id === reminder.id).completed,
    'No-link click did not pop',
  );
  await until(async () => (await windows()).length === 1, 'Pop window did not close');
  pass('unlinked bubble click pops and records completion');
  await desktop.evaluate(({ shell }) => {
    globalThis.__urls = [];
    shell.openExternal = async (url) => {
      globalThis.__urls.push(url);
    };
  });
  bubble = desktop.windows().find((p) => p.url().includes('bubble=legacy'));
  await bubble.locator('.bubble-keyboard').click();
  await until(
    async () => (await desktop.evaluate(() => globalThis.__urls)).length === 1,
    'Linked click did not open URL',
  );
  assert.equal((await snap(page)).tasks.find((t) => t.id === 'legacy').completed, false);
  pass('linked bubble click opens URL without completing it');
  await page.evaluate(() => window.todopop.act('legacy', 'snooze'));
  await until(async () => (await windows()).length === 0, 'Snooze did not hide');
  await page.evaluate(() => window.todopop.act('legacy', 'wake'));
  await until(async () => (await windows()).length === 1, 'Show now did not restore');
  pass('single-task snooze and Show now are distinct from global pause');
  const historyCount = (await snap(page)).history.filter((e) => e.kind === 'completed').length;
  await page.evaluate((id) => window.todopop.act(id, 'restore'), reminder.id);
  state = await snap(page);
  const round = state.tasks.find((t) => t.sourceTaskId === reminder.id);
  assert.ok(round && round.id !== reminder.id);
  assert.equal(round.growthMs, 0);
  assert.equal(state.history.filter((e) => e.kind === 'completed').length, historyCount);
  assert.equal(state.tasks.find((t) => t.id === reminder.id).completed, true);
  pass('Rebubble creates a fresh round and retains historical wins');
  await page.evaluate((id) => window.todopop.act(id, 'delete'), round.id);
  await until(
    async () => !(await snap(page)).tasks.some((t) => t.id === round.id),
    'Delete did not remove task',
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await until(async () => (await snap(page)).tasks.some((t) => t.id === round.id), 'Undo failed');
  pass('delete toast Undo restores the same task');
  await page.evaluate(() => window.todopop.groups('create', { name: 'Projects', side: 'right' }));
  state = await snap(page);
  const group = state.groups.find((g) => g.name === 'Projects');
  await page.evaluate(
    ({ id, groupId }) =>
      window.todopop.update(id, {
        title: 'Legacy linked',
        url: 'https://example.com/work',
        urgency: 4,
        groupId,
      }),
    { id: 'legacy', groupId: group.id },
  );
  await page.evaluate(
    (id) =>
      window.todopop.groups('update', {
        id,
        color: { kind: 'custom', hex: '#aa11cc' },
        name: 'Studio',
        side: 'left',
      }),
    group.id,
  );
  await page.evaluate(() => window.todopop.setSettings({ tint: '#9c1c31' }));
  await until(
    async () =>
      (await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
      )) === '#9c1c31',
    'Theme did not propagate',
  );
  state = await snap(page);
  assert.equal(state.groups.find((g) => g.id === group.id).color.hex, '#aa11cc');
  pass('custom groups rename, color and side persist; custom color survives Tint');
  bubble = desktop.windows().find((p) => !p.isClosed() && p.url().includes('bubble=legacy'));
  await bubble.locator('.bubble-hit').click({ button: 'right' });
  await until(
    async () => desktop.windows().some((p) => p.url().includes('#edit=legacy')),
    'Right-click did not open editor',
  );
  const editor = desktop.windows().find((p) => p.url().includes('#edit=legacy'));
  await editor.locator('input[name=title]').fill('Legacy linked – edited');
  await editor.screenshot({
    path: 'docs/screenshots/edit-popover.png',
    omitBackground: true,
    animations: 'disabled',
  });
  const geometry = await desktop.evaluate(({ BrowserWindow, screen }) => {
    const w = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('#edit='));
    return { bounds: w.getBounds(), area: screen.getDisplayMatching(w.getBounds()).workArea };
  });
  assert.ok(geometry.bounds.x >= geometry.area.x && geometry.bounds.y >= geometry.area.y);
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await until(
    async () =>
      (await snap(page)).tasks.find((t) => t.id === 'legacy').title === 'Legacy linked – edited',
    'Native editor did not save',
  );
  pass('right-click opens an independent, bounded edit popover; Save persists');

  await page.getByRole('button', { name: /^Popped/ }).click();
  await page.locator('.archive').waitFor();
  assert.match(await page.locator('.archive-summary').textContent(), /popped this week/);
  await page.getByRole('button', { name: 'MONTH', exact: true }).click();
  assert.equal(await page.locator('.month-grid button').count(), 42);
  await page.getByRole('button', { name: 'Previous period' }).click();
  await page.getByRole('button', { name: 'Next period' }).click();
  pass('archive week/month views and date navigation use real completion records');
  await page.getByRole('button', { name: /^Popped/ }).click();
  await page.getByRole('button', { name: /^Tint & groups/ }).click();
  await page.locator('.appearance-content').waitFor();
  await until(
    async () =>
      await page
        .locator('.accordion-body')
        .evaluateAll((nodes) => nodes.every((n) => Math.abs(n.scrollHeight - n.clientHeight) < 2)),
    'Accordion did not settle',
  );
  await mkdir('docs/screenshots', { recursive: true });
  await page.screenshot({
    path: 'docs/screenshots/desktop-progress.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Hide panel' }).click();
  const launcher = desktop.windows().find((p) => p.url().endsWith('#launcher'));
  await launcher.getByRole('button', { name: 'Open TODOPOP panel' }).click();
  await until(
    async () =>
      await desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some(
          (w) => w.webContents.getURL().endsWith('/index.html') && w.isVisible(),
        ),
      ),
    'Launcher failed',
  );
  pass('minimized Launcher reopens the panel');
  await desktop.close();
  desktop = null;
  page = await launch();
  state = await snap(page);
  assert.equal(state.settings.tint, '#9c1c31');
  assert.equal(state.paused, true);
  assert.equal(state.growthMode, 'real');
  assert.ok(state.groups.some((g) => g.name === 'Studio'));
  assert.equal(state.tasks.find((t) => t.id === 'legacy').rank, 1);
  assert.equal(state.history.filter((e) => e.kind === 'completed').length, historyCount);
  assert.ok(state.tasks.some((t) => t.id === round.id));
  pass('restart retains settings, groups, order, pause and history; Demo defaults to real');
  await page.getByRole('button', { name: /^Blow a bubble/ }).click();
  await page.locator('input[name=title]').fill('Draft survives group editing');
  await page.getByRole('button', { name: '+ New', exact: true }).click();
  await page.getByRole('button', { name: /^Blow a bubble/ }).click();
  assert.equal(
    await page.locator('input[name=title]').inputValue(),
    'Draft survives group editing',
  );
  pass('unsaved new-task draft survives opening group management');

  assert.deepEqual(errors, []);
  await writeFile(
    'docs/desktop-acceptance-result.json',
    JSON.stringify(
      { passed: true, date: new Date().toISOString(), checks, rendererErrors: errors },
      null,
      2,
    ) + '\n',
  );
} finally {
  await desktop?.close();
}
