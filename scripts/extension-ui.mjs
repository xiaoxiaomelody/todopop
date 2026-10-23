import { chromium } from 'playwright';
import { WebSocketServer } from 'ws';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const token = 'b'.repeat(64),
  profile = await mkdtemp(join(tmpdir(), 'todopop-popup-'));
const server = new WebSocketServer({ host: '127.0.0.1', port: 17846 });
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
  const path = resolve('apps/chrome-extension/dist');
  browser = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: false,
    args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`],
  });
  const worker = browser.serviceWorkers()[0] || (await browser.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;
  const popup = await browser.newPage();
  popup.on('pageerror', (e) => errors.push(String(e)));
  await popup.setViewportSize({ width: 376, height: 600 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('status').filter({ hasText: 'Not paired' }).waitFor();
  await popup.evaluate(() => document.fonts.ready);
  assert.match(
    await popup.locator('body').evaluate((el) => getComputedStyle(el).fontFamily),
    /DM Sans/,
  );
  assert.ok(
    await popup.evaluate(() =>
      Array.from(document.fonts).some(
        (font) => font.family.includes('DM Sans') && font.status === 'loaded',
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
  assert.equal(await popup.locator('.help-steps li').count(), 3);
  await popup.locator('#token').focus();
  assert.equal(
    await popup.locator('#token').evaluate((el) => getComputedStyle(el).outlineStyle),
    'none',
  );
  await popup.screenshot({ path: 'docs/screenshots/extension-input-focus.png', fullPage: true });
  await popup.locator('#token').fill('incomplete');
  await popup.getByRole('button', { name: 'Connect to TODOPOP', exact: true }).click();
  await popup.getByRole('alert').filter({ hasText: 'complete pairing code' }).waitFor();
  await popup.locator('#token').fill('0'.repeat(64));
  await popup.getByRole('button', { name: 'Connect to TODOPOP', exact: true }).click();
  await popup.getByRole('status').filter({ hasText: 'Check pairing code' }).waitFor();
  await popup.locator('#token').fill(' ' + token + ' ');
  await popup.getByRole('button', { name: 'Connect to TODOPOP', exact: true }).click();
  await popup.getByRole('status').filter({ hasText: 'Connected' }).waitFor();
  assert.equal(await popup.locator('#token').count(), 0);
  await popup.getByRole('button', { name: 'Where’s my code?' }).click();
  await popup.screenshot({ path: 'docs/screenshots/extension-connected.png', fullPage: true });
  for (const client of server.clients)
    client.send(JSON.stringify({ type: 'APPEARANCE', tint: '#078b86' }));
  await popup.waitForFunction(
    () => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() === '#078b86',
  );
  await popup.getByRole('button', { name: 'Change pairing code' }).click();
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
  const layout = await popup.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > 376,
    bodyWidth: document.body.clientWidth,
  }));
  assert.equal(layout.overflow, false);
  assert.equal(layout.bodyWidth, 376);
  console.log(
    'PASS extension UI: shared font/logo, help, validation, token rejection, real pairing, hidden secret, reconnect, disconnect, layout; zero renderer errors',
  );
  await writeFile(
    'docs/extension-ui-test.json',
    JSON.stringify(
      {
        passed: true,
        date: new Date().toISOString(),
        checks: [
          'local DM Sans and Figma logo',
          'help accordion',
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
