import { _electron as electron } from 'playwright';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(), 'todopop-package-'));
const executablePath = resolve('release/mac-arm64/TODOPOP.app/Contents/MacOS/TODOPOP');
let desktop;
try {
  desktop = await electron.launch({
    executablePath,
    args: [],
    env: { ...process.env, TODOPOP_DATA_DIR: dir },
    timeout: 20000,
  });
  const version = await desktop.evaluate(({ app }) => app.getVersion());
  assert.equal(version, JSON.parse(await readFile('apps/desktop/package.json', 'utf8')).version);
  const page = await desktop.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.waitForSelector('.control-panel');
  assert.ok(await desktop.evaluate(({ app }) => app.isPackaged));
  await page.evaluate(() => window.todopop.create({ title: 'Packaged smoke task', urgency: 1 }));
  await page.waitForFunction(async () => (await window.todopop.snapshot()).tasks.length === 1);
  const task = await page.evaluate(async () => (await window.todopop.snapshot()).tasks[0]);
  await page.evaluate((id) => window.todopop.act(id, 'complete'), task.id);
  assert.equal(
    await page.evaluate(
      async () =>
        (await window.todopop.snapshot()).history.filter((e) => e.kind === 'completed').length,
    ),
    1,
  );
  await page.screenshot({
    path: 'docs/screenshots/packaged-app.png',
    omitBackground: true,
    animations: 'disabled',
  });
  assert.deepEqual(errors, []);
  await desktop.close();
  desktop = null;
  await writeFile(
    'docs/package-smoke-result.json',
    JSON.stringify(
      {
        passed: true,
        date: new Date().toISOString(),
        version,
        architecture: 'arm64',
        packaged: true,
        isolatedUserData: true,
        checks: [
          'launches from app.asar',
          'creates task',
          'records completion',
          'closes after flushing state',
        ],
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('PASS packaged arm64 app starts, runs task commands and quits cleanly');
} finally {
  await desktop?.close();
}
