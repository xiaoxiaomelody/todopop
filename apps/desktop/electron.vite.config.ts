import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@todopop/shared'] })],
    build: {
      outDir: 'dist-electron/main',
      rollupOptions: {
        input: resolve('electron/main.ts'),
        output: { format: 'cjs', entryFileNames: 'main.cjs' },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/preload',
      rollupOptions: {
        input: resolve('electron/preload.ts'),
        output: { format: 'cjs', entryFileNames: 'preload.cjs' },
      },
    },
  },
  renderer: {
    root: '.',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'todopop-csp',
        transformIndexHtml(html, context) {
          return html.replace(
            '__SCRIPT_POLICY__',
            context.server ? "'self' 'unsafe-inline'" : "'self'",
          );
        },
      },
    ],
    build: { outDir: 'dist', rollupOptions: { input: resolve('index.html') } },
  },
});
