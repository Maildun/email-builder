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
  deps: { neverBundle: [/^react($|\/)/, /^react-dom($|\/)/, /^node:/] },
});
