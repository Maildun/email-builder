import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    editor: 'src/editor/index.ts',
    agent: 'src/agent/index.ts',
    compat: 'src/compat/index.ts',
    cli: 'src/render/cli.ts',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  clean: true,
  sourcemap: true,
  external: [/^react($|\/)/, /^react-dom($|\/)/],
  copy: [{ from: 'src/editor/styles.css', to: 'dist/editor.css' }],
});
