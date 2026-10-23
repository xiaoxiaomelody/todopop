import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['background.ts', 'popup.tsx'],
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  target: 'chrome120',
  outdir: 'dist',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.woff2': 'file', '.svg': 'file' },
  assetNames: 'assets/[name]-[hash]',
});
for (const name of ['manifest.json', 'popup.html']) await copyFile(name, `dist/${name}`);
