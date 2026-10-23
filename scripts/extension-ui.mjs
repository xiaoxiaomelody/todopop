import { chromium } from 'playwright';
import { WebSocketServer } from 'ws';
import { mkdtemp, mkdir, writeFile, readFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const token = 'b'.repeat(64),
  profile = await mkdtemp(join(tmpdir(), 'todopop-popup-'));
const port = Number(process.env.TODOPOP_TEST_PORT || 17846);
const server = new WebSocketServer({ host: '127.0.0.1', port });
server.on('connection', (socket) =>
  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.type === 'AUTH') {
      if (message.token !== token) socket.close(4001);
      else socket.send(JSON.stringify({ type: 'AUTH_OK' }));
    }
  }),
);
let browser;
const errors = [];
try {
  let path = resolve('apps/chrome-extension/dist');
  if (port !== 17846) {
    const isolated = join(profile, 'extension');
    await cp(path, isolated, { recursive: true });
    for (const name of ['background.js', 'manifest.json']) {
      const file = join(isolated, name);
      await writeFile(file, (await readFile(file, 'utf8')).replaceAll('17846', String(port)));
    }
    path = isolated;
  }
  browser = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: false,
    viewport: null,
    args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`],
  });
  const worker = browser.serviceWorkers()[0] || (await browser.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;
  const bootstrap = await browser.newPage();
  await bootstrap.goto(`chrome-extension://${extensionId}/popup.html`);
  assert.equal(await worker.evaluate(() => chrome.action.onClicked.hasListeners()), true);
  assert.equal(
    await worker.evaluate(() => Boolean(chrome.runtime.getManifest().action.default_popup)),
    false,
  );
  const panelPage = browser.waitForEvent('page');
  await bootstrap.evaluate(() => chrome.runtime.sendMessage({ type: 'OPEN_PANEL' }));
  const popup = await panelPage;
  await bootstrap.close();
  await popup.waitForLoadState();
  const panelId = await popup.evaluate(async () => (await chrome.windows.getCurrent()).id);
  await popup.evaluate(() =>
    Promise.all([
      chrome.runtime.sendMessage({ type: 'OPEN_PANEL' }),
      chrome.runtime.sendMessage({ type: 'OPEN_PANEL' }),
    ]),
  );
  const panelWindows = await worker.evaluate(async () =>
    (await chrome.windows.getAll({ populate: true, windowTypes: ['popup'] }))
      .filter((w) => w.tabs?.some((t) => t.url === chrome.runtime.getURL('popup.html')))
      .map((w) => w.id),
  );
  assert.deepEqual(panelWindows, [panelId]);
  popup.on('pageerror', (e) => errors.push(String(e)));
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('status').filter({ hasText: 'Not paired' }).waitFor();
  await popup.evaluate(() => document.fonts.ready);
  assert.match(
    await popup.locator('body').evaluate((el) => getComputedStyle(el).fontFamily),
    /Unbounded/,
  );
  assert.ok(
    await popup.evaluate(() =>
      Array.from(document.fonts).some(
        (font) => font.family.includes('Unbounded') && font.status === 'loaded',
      ),
    ),
  );

  assert.ok(
    await popup
      .locator('.logo img')
      .evaluateAll(
        (imgs) => imgs.length === 3 && imgs.every((i) => i.complete && i.naturalWidth > 0),
      ),
  );
  await mkdir('docs/screenshots', { recursive: true });
  await popup.screenshot({ path: 'docs/screenshots/extension-unpaired.png', fullPage: true });
  await popup.getByRole('button', { name: 'Where’s my code?' }).click();
  await popup.locator('#pairing-help').waitFor();
  await popup.locator('#token').focus();
  assert.equal(
    await popup.locator('#token').evaluate((el) => getComputedStyle(el).outlineStyle),
    'none',
  );
  await popup.screenshot({ path: 'docs/screenshots/extension-input-focus.png', fullPage: true });
  await popup.locator('#token').fill('incomplete');
  await popup.getByRole('button', { name: 'Connect', exact: true }).click();
  await popup.getByRole('alert').filter({ hasText: 'complete pairing code' }).waitFor();
  await popup.locator('#token').fill('0'.repeat(64));
  await popup.getByRole('button', { name: 'Connect', exact: true }).click();
  await popup.getByRole('status').filter({ hasText: 'Check pairing code' }).waitFor();
  await popup.locator('#token').fill(' ' + token + ' ');
  await popup.getByRole('button', { name: 'Connect', exact: true }).click();
  await popup.getByRole('status').filter({ hasText: 'Connected' }).waitFor();
  assert.equal(await popup.locator('#token').count(), 0);
  assert.equal(await popup.locator('.description').innerText(), 'Automatic focus is on.');
  await popup.waitForFunction(() => window.innerHeight <= 240);
  await popup.screenshot({ path: 'docs/screenshots/extension-connected.png', fullPage: true });
  for (const client of server.clients)
    client.send(JSON.stringify({ type: 'APPEARANCE', tint: '#078b86' }));
  await popup.waitForFunction(
    () => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() === '#078b86',
  );
  await popup.getByRole('button', { name: 'Change code' }).click();
  assert.equal(await popup.locator('#token').inputValue(), '');
  assert.equal(await popup.locator('#token').getAttribute('type'), 'password');
  await popup.getByRole('button', { name: 'Show', exact: true }).click();
  assert.equal(await popup.locator('#token').getAttribute('type'), 'text');
  await popup.getByRole('button', { name: 'Cancel', exact: true }).click();
  for (const client of server.clients) client.close(4000);
  await popup.getByRole('status').filter({ hasText: 'Disconnected' }).waitFor();
  await popup.getByRole('button', { name: 'Try again', exact: true }).click();
  await popup.getByRole('status').filter({ hasText: 'Connected' }).waitFor();
  await popup.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await popup.getByRole('status').filter({ hasText: 'Not paired' }).waitFor();
  assert.equal(
    await worker.evaluate(async () => Boolean((await chrome.storage.local.get('token')).token)),
    false,
  );
  assert.deepEqual(errors, []);
  await popup.waitForFunction(
    () => document.documentElement.scrollHeight <= window.innerHeight + 1,
  );
  const layout = await popup.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    viewportWidth: window.innerWidth,
    bodyWidth: document.body.clientWidth,
  }));
  assert.equal(layout.overflow, false);
  assert.equal(layout.bodyWidth, layout.viewportWidth);
  assert.ok(layout.bodyWidth >= 320 && layout.bodyWidth <= 376);
  console.log(
    'PASS extension UI: shared font/logo, help, validation, token rejection, real pairing, hidden secret, reconnect, disconnect, layout; zero renderer errors',
  );
  await writeFile(
    'docs/extension-ui-test.json',
    JSON.stringify(
      {
        passed: true,
        date: new Date().toISOString(),
        isolatedBridgePort: port,
        checks: [
          'local Unbounded and Figma logo',
          'compact help',
          'standalone native window and singleton reuse',
          'invalid input',
          'rejected token',
          'authenticated pairing',
          'secret visibility',
          'retry',
          'disconnect',
          'popup bounds',
        ],
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await browser?.close();
  for (const c of server.clients) c.terminate();
  await new Promise((r) => server.close(r));
}
