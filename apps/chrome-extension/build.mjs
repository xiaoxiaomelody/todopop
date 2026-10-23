import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['background.ts', 'popup.ts'],
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  outdir: 'dist',
});
for (const name of ['manifest.json', 'popup.html', 'popup.css'])
  await copyFile(name, `dist/${name}`);
