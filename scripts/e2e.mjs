import { _electron as electron, chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { createServer } from 'node:http';
const requireDesktop = createRequire(resolve('apps/desktop/package.json'));
const WebSocket = requireDesktop('ws');
const dataDir = await mkdtemp(join(tmpdir(), 'todopop-e2e-'));
const browserDir = await mkdtemp(join(tmpdir(), 'todopop-chrome-'));
await mkdir('docs/screenshots', { recursive: true });
let desktop, browser, socket;
let foregroundFixture = false;
const errors = [];
const testPort = Number(process.env.TODOPOP_TEST_PORT || 17848);
const server = createServer((_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(
    '<html><head><title>TODOPOP work page</title></head><body><h1>Local work page</h1></body></html>',
  );
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
async function until(fn, message, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await fn()) return;
    } catch (e) {
      if (!String(e).includes('Resulting promise was garbage collected')) throw e;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(message);
}
async function launch() {
  desktop = await electron.launch({
    args: [resolve('apps/desktop')],
    env: { ...process.env, TODOPOP_DATA_DIR: dataDir, TODOPOP_TEST_PORT: String(testPort) },
    timeout: 20000,
  });
  desktop.process().stderr?.on('data', (data) => {
    if (/Error|Exception/.test(String(data)))
      console.log('Electron diagnostic:', String(data).trim());
  });
  desktop.on('window', (p) => p.on('pageerror', (e) => errors.push(String(e))));
  const page = await desktop.firstWindow();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.waitForSelector('.control-panel');
  await until(
    async () => !(await snap(page)).error?.includes('Chrome connection unavailable'),
    'Close the running TODOPOP app before starting the integration test',
    1500,
  );
  if (await page.getByRole('button', { name: 'Close shortcuts', exact: true }).count())
    await page.getByRole('button', { name: 'Close shortcuts', exact: true }).click();
  return page;
}
const snap = (page) => page.evaluate(() => window.todopop.snapshot());
const bubbleWindows = () =>
  desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .filter((w) => w.webContents.getURL().includes('#bubble='))
      .map((w) => ({
        id: w.id,
        visible: w.isVisible(),
        bounds: w.getBounds(),
        alwaysOnTop: w.isAlwaysOnTop(),
        focusable: w.isFocusable(),
      })),
  );
try {
  let page = await launch();
  assert.equal((await snap(page)).tasks.length, 0);
  // Unregistered/stale mouse and panel messages must be ignored, not throw in main.
  await desktop.evaluate(({ BrowserWindow, ipcMain }) => {
    const stale = new BrowserWindow({ show: false });
    const event = { sender: stale.webContents, senderFrame: stale.webContents.mainFrame };
    ipcMain.emit('bubble:hit', event, true);
    ipcMain.emit('bubble:drag', event, 'move', 100, 100);
    ipcMain.emit('panel:resize', event, 500);
    ipcMain.emit('panel:hide', event);
    stale.destroy();
    ipcMain.emit('bubble:hit', event, false);
  });
  console.log('PASS stale/unregistered window events are rejected without uncaught exceptions');

  await page.getByRole('button', { name: 'Blow a bubble' }).click();
  await page.locator('input[name=title]').fill('Problem set 4');
  await page.locator('.link-details summary').click();
  await page.locator('input[name=url]').fill(`${origin}/work`);
  await page.getByRole('radio', { name: 'NOW!', exact: true }).click();
  await page.getByRole('button', { name: 'School', exact: true }).click();
  await page.getByRole('button', { name: 'Blow it', exact: true }).click();
  await until(async () => (await snap(page)).tasks.length === 1, 'Task creation failed');
  await until(
    async () => (await page.locator('.task-form').count()) === 0,
    'Form did not collapse',
  );
  const task = (await snap(page)).tasks[0];
  await until(
    async () => (await bubbleWindows()).length === 1 && (await bubbleWindows())[0].visible,
    'Bubble did not appear',
  );
  let bubble = desktop.windows().find((p) => p.url().includes('#bubble='));
  await bubble.waitForSelector('.organic-hit');
  const native = (await bubbleWindows())[0];
  assert.equal(native.alwaysOnTop, true);
  assert.equal(native.focusable, false);
  assert.ok(task.size >= 446 && task.size < 450);
  assert.ok(native.bounds.width > 0 && native.bounds.width <= task.size);
  await page.screenshot({
    path: 'docs/screenshots/panel.png',
    omitBackground: true,
    animations: 'disabled',
  });
  await bubble.screenshot({
    path: 'docs/screenshots/bubble.png',
    omitBackground: true,
    animations: 'disabled',
  });
  console.log('PASS task creation, native transparent bubble, Figma UI assets');
  // Clicking opens the task URL; completion is a separate explicit action.
  await desktop.evaluate(({ shell }) => {
    globalThis.__todopopOpened = [];
    shell.openExternal = (url) => {
      globalThis.__todopopOpened.push(url);
    };
  });
  await bubble.locator('.organic-hit').click();
  await until(
    async () =>
      (await desktop.evaluate(() => globalThis.__todopopOpened)).includes(`${origin}/work`),
    'Bubble click did not open the task URL',
  );
  assert.equal((await snap(page)).tasks[0].completed, false);
  // The preload API remains narrow and drag persistence passes through Electron main.
  const hit = await bubble.locator('.organic-hit').boundingBox();
  await bubble.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 2);
  await bubble.mouse.down();
  await bubble.mouse.move(hit.x + hit.width / 2 + 90, hit.y + hit.height / 2 + 70, { steps: 5 });
  await bubble.mouse.up();
  await until(async () => Boolean((await snap(page)).tasks[0].position), 'Position was not saved');
  const moved = (await bubbleWindows())[0].bounds;
  assert.notEqual(moved.x, native.bounds.x);
  const position = (await snap(page)).tasks[0].position;
  console.log('PASS drag bounds and persisted position');
  // Invalid browser origins and incorrect pairing codes must not gain access.
  const rejected = new WebSocket(`ws://127.0.0.1:${testPort}`, { origin: 'https://example.com' });
  await new Promise((resolve, reject) => {
    rejected.on('error', () => resolve());
    rejected.on('open', () => {
      rejected.close();
      reject(new Error('Website origin accepted'));
    });
  });
  const bad = new WebSocket(`ws://127.0.0.1:${testPort}`, {
    origin: `chrome-extension://${'a'.repeat(32)}`,
  });
  await once(bad, 'open');
  bad.send(JSON.stringify({ type: 'AUTH', token: '0'.repeat(64) }));
  await once(bad, 'close');
  assert.equal((await snap(page)).connected, false);
  console.log('PASS bridge rejects website origins and invalid pairing tokens');
  const pairing = await page.evaluate(() => window.todopop.pairing());
  socket = new WebSocket(`ws://127.0.0.1:${testPort}`, {
    origin: `chrome-extension://${'a'.repeat(32)}`,
  });
  await once(socket, 'open');
  const auth = once(socket, 'message', { signal: AbortSignal.timeout(5000) });
  socket.send(JSON.stringify({ type: 'AUTH', token: pairing.token }));
  await auth;
  const context = (url, isFocused = true) =>
    socket.send(JSON.stringify({ type: 'CONTEXT_CHANGED', browser: 'chrome', isFocused, url }));
  context(`${origin}/work`);
  await until(async () => (await snap(page)).focus === 'FOCUS', 'Matching context did not focus');
  assert.ok((await bubbleWindows()).every((w) => !w.visible));
  context(`${origin}/unrelated`);
  await until(async () => (await snap(page)).focus === 'NORMAL', 'Unrelated page did not restore');
  assert.ok((await bubbleWindows()).every((w) => w.visible));
  context(`${origin}/work`, false);
  await until(async () => (await snap(page)).focus === 'NORMAL', 'Background Chrome focused');
  context(`${origin}/work`);
  await until(async () => (await snap(page)).focus === 'FOCUS', 'Return to work failed');
  socket.close();
  await until(
    async () => !(await snap(page)).connected && (await snap(page)).focus === 'NORMAL',
    'Disconnect did not reset focus',
  );
  socket = null;
  console.log(
    'PASS authenticated focus/normal transitions, non-foreground context, disconnect fallback',
  );
  // Run the real Manifest V3 worker in a separate disposable Chromium profile.
  const extensionPath = join(browserDir, 'extension');
  await cp(resolve('apps/chrome-extension/dist'), extensionPath, { recursive: true });
  for (const name of ['background.js', 'manifest.json']) {
    const file = join(extensionPath, name);
    await writeFile(file, (await readFile(file, 'utf8')).replaceAll('17846', String(testPort)));
  }

  browser = await chromium.launchPersistentContext(browserDir, {
    channel: 'chromium',
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const worker = browser.serviceWorkers()[0] || (await browser.waitForEvent('serviceworker'));
  await worker.evaluate((token) => chrome.storage.local.set({ token }), pairing.token);
  const work = await browser.newPage();
  await work.goto(`${origin}/work`);
  await work.bringToFront();
  await worker.evaluate(async () => {
    const win = await chrome.windows.getLastFocused();
    await chrome.windows.update(win.id, { focused: true });
  });
  const nativeChromeFocus = await worker.evaluate(
    async () => (await chrome.windows.getLastFocused()).focused,
  );
  if (!nativeChromeFocus || process.env.TODOPOP_TEST_FOREGROUND_FIXTURE === '1') {
    foregroundFixture = true;
    await worker.evaluate(() => {
      const original = chrome.windows.getLastFocused.bind(chrome.windows);
      globalThis.__todoForeground = true;
      chrome.windows.getLastFocused = async (...args) => ({
        ...(await original(...args)),
        focused: globalThis.__todoForeground,
      });
    });
    await work.goto(`${origin}/work#foreground-fixture`);
    console.log(
      'NOTE Foreground is injected at the Chrome API boundary for this run. Native app switching remains a manual check.',
    );
  }
  await until(
    async () => (await snap(page)).focus === 'FOCUS',
    'Real extension did not activate focus',
    20000,
  );
  await work.goto(`${origin}/other`);
  await until(
    async () => (await snap(page)).focus === 'NORMAL',
    'Real navigation did not restore bubbles',
  );
  await work.goto(`${origin}/work`);
  await until(async () => (await snap(page)).focus === 'FOCUS', 'Real return did not focus');
  const other = await browser.newPage();
  await other.goto(`${origin}/distraction`);
  await other.bringToFront();
  await until(async () => (await snap(page)).focus === 'NORMAL', 'Real tab switch did not restore');
  await work.bringToFront();
  await until(async () => (await snap(page)).focus === 'FOCUS', 'Real tab return did not focus');
  if (foregroundFixture)
    await worker.evaluate(() => {
      globalThis.__todoForeground = false;
    });
  await desktop.evaluate(({ BrowserWindow }) => {
    const panel = BrowserWindow.getAllWindows().find(
      (w) => !w.webContents.getURL().includes('#bubble='),
    );
    panel.show();
    panel.focus();
  });
  await until(
    async () => (await snap(page)).focus === 'NORMAL',
    'Switching to Electron did not restore bubbles',
    20000,
  );
  console.log(
    'PASS real MV3 worker pairing, navigation and tab switches; foreground transitions ' +
      (foregroundFixture ? 'use an explicit boundary fixture' : 'verified natively'),
  );
  await browser.close();
  browser = null;
  await until(
    async () => !(await snap(page)).connected && (await snap(page)).focus === 'NORMAL',
    'Chrome disconnect did not settle',
  );
  await until(
    async () => (await bubbleWindows()).length === 1,
    'Bubble did not remain visible after Focus',
  );
  bubble = desktop.windows().find((p) => !p.isClosed() && p.url().includes('#bubble='));
  await bubble.waitForFunction(
    async () =>
      document.querySelector('.organic-art path')?.getAttribute('d')?.includes('Q') &&
      (await window.todopop.snapshot()).focus === 'NORMAL',
  );
  await bubble.locator('.organic-hit').click({ delay: 950 });
  await until(async () => (await snap(page)).tasks[0].completed, 'Completion failed');
  await until(async () => (await bubbleWindows()).length === 0, 'Completed bubble remained');
  const persisted = JSON.parse(await readFile(join(dataDir, 'state.json'), 'utf8')).tasks;
  assert.equal(persisted[0].completed, true);
  await desktop.close();
  desktop = null;
  page = await launch();
  assert.equal((await snap(page)).tasks[0].completed, true);
  assert.deepEqual((await snap(page)).tasks[0].position, persisted[0].position);
  assert.equal((await bubbleWindows()).length, 0);
  await page.getByRole('button', { name: 'Popped bubbles', exact: true }).click();
  await page.getByRole('button', { name: 'Restore Problem set 4' }).click();
  await until(
    async () =>
      (await bubbleWindows()).length === 1 &&
      (await snap(page)).tasks.some((t) => !t.completed && t.sourceTaskId === task.id),
    'Archive restore failed',
  );
  console.log('PASS completion pop, restart persistence, and archive restore');
  await page.getByRole('button', { name: 'Blow a bubble', exact: true }).click();
  await page.locator('.floating-details summary').click();
  await page.locator('.task-name').click();
  await until(
    async () => desktop.windows().some((p) => p.url().includes('#edit=')),
    'Editor did not open',
  );
  let edit = desktop.windows().find((p) => p.url().includes('#edit='));
  await edit.locator('.edit-panel input[name=title]').fill('Graph search notes');
  await edit.locator('.edit-panel').getByRole('button', { name: 'Save', exact: true }).click();
  await until(
    async () =>
      (await snap(page)).tasks.some((t) => !t.completed && t.title === 'Graph search notes'),
    'Edit did not persist',
  );
  await page.locator('.task-name').click();
  await until(
    async () => desktop.windows().some((p) => p.url().includes('#edit=')),
    'Editor did not reopen',
  );
  edit = desktop.windows().find((p) => p.url().includes('#edit='));
  await edit.locator('.edit-panel').getByRole('button', { name: 'Delete', exact: true }).click();
  await until(
    async () => (await snap(page)).tasks.filter((t) => !t.completed).length === 0,
    'Delete failed',
  );
  await until(
    async () => (await bubbleWindows()).length === 0,
    'Deleted bubble did not finish its exit animation',
  );
  // Every urgency gets its own native size and locally loaded vector assets.
  for (const urgency of [1, 2, 3, 4])
    await page.evaluate(
      (urgency) => window.todopop.create({ title: `Urgency ${urgency}`, urgency }),
      urgency,
    );
  await until(async () => (await bubbleWindows()).length === 4, 'Multiple bubbles not created');
  const sizes = (await snap(page)).tasks
    .filter((t) => !t.completed)
    .map((t) => t.size)
    .sort((a, b) => a - b);
  for (let i = 0; i < sizes.length; i++)
    assert.ok(sizes[i] >= [118, 192, 298, 446][i] && sizes[i] < [118, 192, 298, 446][i] + 6);
  for (const p of desktop.windows().filter((p) => p.url().includes('#bubble='))) {
    await p.waitForSelector('.organic-hit');
    const assets = await p
      .locator('img')
      .evaluateAll((imgs) => imgs.every((img) => img.complete && img.naturalWidth > 0));
    assert.ok(assets, 'Bubble asset failed to load');
  }
  await desktop.close();
  desktop = null;
  // A malformed local file is backed up and surfaced; it is never silently destroyed.
  await writeFile(join(dataDir, 'state.json'), '{invalid json');
  page = await launch();
  assert.match((await snap(page)).error, /copy was kept/);
  assert.equal((await snap(page)).tasks.length, 0);
  assert.deepEqual(errors, []);
  console.log(
    'PASS editing, deletion, all four sizes, local assets, corrupt-file recovery, and zero renderer exceptions',
  );
  await writeFile(
    'docs/e2e-result.json',
    JSON.stringify(
      {
        passed: true,
        date: new Date().toISOString(),
        checks: [
          'task CRUD',
          'native bubbles',
          'drag persistence',
          'origin/token authentication',
          'focus transitions',
          'real MV3 extension',
          'navigation and foreground changes',
          'restart persistence',
          'archive restore',
          'Figma assets',
        ],
        rendererErrors: errors,
        nativeForegroundVerified: !foregroundFixture,
        foregroundFixture,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  socket?.close();
  await browser?.close();
  await desktop?.close();
  server.close();
}
