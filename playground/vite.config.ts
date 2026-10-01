import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { standalonePlugins } from '../scripts/css';

const src = (path: string) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // The social icons, served at /social/… (see ASSETS_URL in App.tsx).
  publicDir: fileURLToPath(new URL('../assets', import.meta.url)),
  // Same pipeline as dist/styles.css, so the playground shows what standalone users get.
  css: { postcss: { plugins: standalonePlugins() } },
  resolve: {
    alias: [
      { find: /^@maildun\/email-builder$/, replacement: src('index.ts') },
      {
        find: '@maildun/email-builder/styles.css',
        replacement: src('editor/styles/standalone.css'),
      },
      { find: '@maildun/email-builder/editor', replacement: src('editor/index.ts') },
      { find: '@maildun/email-builder/agent', replacement: src('agent/index.ts') },
      { find: '@maildun/email-builder/compat', replacement: src('compat/index.ts') },
    ],
    dedupe: ['react', 'react-dom'],
  },
});
