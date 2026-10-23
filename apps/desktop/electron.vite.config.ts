import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()], build: { outDir: 'dist-electron', rollupOptions: { input: resolve('electron/main.ts'), output: { format: 'cjs', entryFileNames: 'main.cjs' } } } },
  preload: { plugins: [externalizeDepsPlugin()], build: { outDir: 'dist-electron', rollupOptions: { input: resolve('electron/preload.ts'), output: { format: 'cjs', entryFileNames: 'preload.cjs' } } } },
  renderer: { root: '.', plugins: [react(), tailwindcss()], build: { outDir: 'dist', rollupOptions: { input: resolve('index.html') } } },
});
