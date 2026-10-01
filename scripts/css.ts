import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import tailwind from '@tailwindcss/postcss';
import postcss, { type AtRule, type Node, type Plugin, type Rule } from 'postcss';

const stylesDir = join(import.meta.dirname, '../src/editor/styles');
export const STANDALONE_ENTRY = join(stylesDir, 'standalone.css');

const SCOPE = '.meb-root';
const ROOT_SELECTORS = new Set([':root', ':host', 'html', 'body']);

function insideAtRule(rule: Rule, test: (atRule: AtRule) => boolean): boolean {
  for (let node: Node | undefined = rule.parent as Node | undefined; node; ) {
    if (node.type === 'atrule' && test(node as AtRule)) return true;
    node = node.parent as Node | undefined;
  }
  return false;
}

/** Email HTML on the canvas relies on browser defaults, so preflight must skip it. */
const NOT_CANVAS = ':not(:where(.meb-leaf *, .meb-inline-editor *))';

/** Adds the canvas exclusion before any pseudo-element (`a::before` → `a:not(…)::before`). */
function excludeCanvas(selector: string): string {
  const pseudoElement = selector.indexOf('::');
  return pseudoElement === -1
    ? `${selector}${NOT_CANVAS}`
    : `${selector.slice(0, pseudoElement)}${NOT_CANVAS}${selector.slice(pseudoElement)}`;
}

function scopeSelector(selector: string): string {
  // The editor's own rules (tokens.css, editor.css) are already scoped.
  if (selector.includes('.meb-')) return selector;
  if (ROOT_SELECTORS.has(selector)) return SCOPE;
  // `*` and bare pseudo-elements also cover the root element itself.
  if (selector.startsWith('*')) return `:where(${SCOPE}, ${SCOPE} *)${selector.slice(1)}`;
  if (selector.startsWith('::')) return `:where(${SCOPE}, ${SCOPE} *)${selector}`;
  return `:where(${SCOPE}) ${selector}`;
}

/**
 * Scopes Tailwind's output (theme variables, preflight, utilities) to the
 * editor so it never styles the host page, and flattens cascade layers so the
 * host page's unlayered CSS can't beat it either. `:where()` keeps
 * specificity unchanged, so stylesheets loaded after this one still win.
 */
export function scopeToEditor(): Plugin {
  return {
    postcssPlugin: 'meb-scope-to-editor',
    OnceExit(root) {
      if (root.source?.input.file !== STANDALONE_ENTRY) return;
      root.walkRules((rule) => {
        if (insideAtRule(rule, (atRule) => /keyframes$/.test(atRule.name))) return;
        const base = insideAtRule(
          rule,
          (atRule) => atRule.name === 'layer' && atRule.params === 'base',
        );
        rule.selectors = [
          ...new Set(
            rule.selectors.map((selector) => {
              const own = selector.includes('.meb-');
              const scoped = scopeSelector(selector.trim());
              return base && !own ? excludeCanvas(scoped) : scoped;
            }),
          ),
        ];
      });
      root.walkAtRules('layer', (layer) => {
        if (layer.nodes?.length) layer.replaceWith(layer.nodes);
        else layer.remove();
      });
    },
  };
}

const read = (name: string) => readFileSync(join(stylesDir, name), 'utf8');

/** PostCSS plugins that turn standalone.css into dist/styles.css (also used by the playground). */
export const standalonePlugins = () => [tailwind(), scopeToEditor()];

/** dist/styles.css: everything compiled, for apps without Tailwind CSS 4. */
export async function buildStandalone(): Promise<string> {
  const result = await postcss(standalonePlugins()).process(read('standalone.css'), {
    from: STANDALONE_ENTRY,
  });
  return result.css;
}

/** dist/core.css: for Tailwind CSS 4 apps that compile the editor's classes themselves. */
export function buildCore(): string {
  return [
    read('core.css').replace(/^@import[^;]+;\n?/gm, ''),
    read('theme.css'),
    `@layer components {\n${read('editor.css')}\n}`,
  ].join('\n');
}
