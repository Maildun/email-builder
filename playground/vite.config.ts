import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { agentMiddleware } from './agent-middleware';

const src = (path: string) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

export default defineConfig({
  plugins: [react(), agentMiddleware()],
  resolve: {
    alias: [
      { find: /^@maildun\/email-builder$/, replacement: src('index.ts') },
      { find: '@maildun/email-builder/editor.css', replacement: src('editor/styles.css') },
      { find: '@maildun/email-builder/editor', replacement: src('editor/index.ts') },
      { find: '@maildun/email-builder/agent', replacement: src('agent/index.ts') },
      { find: '@maildun/email-builder/compat', replacement: src('compat/index.ts') },
    ],
    dedupe: ['react', 'react-dom'],
  },
});
