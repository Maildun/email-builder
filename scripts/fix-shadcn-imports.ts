/**
 * Post-processes components added by the shadcn CLI:
 * - rewrites alias imports (`@/editor/...`, `cn`) to relative paths, so the
 *   published build has no path aliases;
 * - portals popups into the editor (inside `.meb-root`) instead of <body>, so
 *   they keep the editor's scoped styles and theme.
 * Run after `bunx shadcn@latest add <name>`: `bun run ui:fix`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const uiDir = join(root, 'src/editor/ui');

function toRelative(fromFile: string, target: string): string {
  const path = relative(dirname(fromFile), join(root, 'src', target));
  return path.startsWith('.') ? path : `./${path}`;
}

for (const name of readdirSync(uiDir)) {
  if (!name.endsWith('.tsx') || name === 'index.tsx') continue;
  const file = join(uiDir, name);
  const source = readFileSync(file, 'utf8');
  let next = source
    .replace(/from ["']cn["']/g, `from "${toRelative(file, 'editor/lib/utils')}"`)
    .replace(
      /from ["']@\/([^"']+)["']/g,
      (_, target: string) => `from "${toRelative(file, target)}"`,
    );
  if (/<\w+Primitive\.Portal>/.test(next)) {
    next = next.replace(
      /<(\w+Primitive)\.Portal>/g,
      '<$1.Portal container={usePortalContainer()}>',
    );
    if (!next.includes('lib/portal')) {
      next = next.replace(
        /(import \{ cn \} from "[^"]+")/,
        `import { usePortalContainer } from "${toRelative(file, 'editor/lib/portal')}"\n$1`,
      );
    }
  }
  if (next !== source) writeFileSync(file, next);
}
