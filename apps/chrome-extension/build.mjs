import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['background.ts'], bundle: true, format: 'esm', target: 'chrome116', outfile: 'dist/background.js' });
await copyFile('manifest.json', 'dist/manifest.json');
