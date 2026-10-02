import { defineConfig } from 'vitepress';

const repo = 'https://github.com/Maildun/email-builder';
// The GitHub Pages workflow sets DOCS_BASE=/email-builder/; a custom domain uses /.
const base = process.env.DOCS_BASE ?? '/';

export default defineConfig({
  title: 'Email Builder',
  description:
    'An agentic-first email builder for React and TypeScript: a typed document model, an operations API for LLM agents, an email-safe HTML renderer and a modern editor.',
  base,
  cleanUrls: true,
  ignoreDeadLinks: 'localhostLinks',
  lastUpdated: true,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}logo.svg` }]],
  markdown: {
    // Merge tags like `{{ first_name }}` are everywhere in these docs; keep Vue
    // from treating them as template interpolation (code blocks already are).
    config: (md) => {
      const codeInline = md.renderer.rules.code_inline;
      md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
        tokens[idx]?.attrSet('v-pre', '');
        return codeInline
          ? codeInline(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options);
      };
    },
  },
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'Editor', link: '/editor/', activeMatch: '/editor/' },
      { text: 'AI', link: '/ai/agents', activeMatch: '/ai/' },
      { text: 'Reference', link: '/reference/blocks', activeMatch: '/reference/' },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is Email Builder?', link: '/guide/introduction' },
          { text: 'Getting started', link: '/guide/getting-started' },
        ],
      },
      {
        text: 'Core concepts',
        items: [
          { text: 'The document', link: '/guide/document' },
          { text: 'Operations', link: '/guide/operations' },
          { text: 'Validation and lint', link: '/guide/validation' },
          { text: 'Sections and templates', link: '/guide/sections' },
          { text: 'Rendering and sending', link: '/guide/rendering' },
          { text: 'Custom blocks', link: '/guide/custom-blocks' },
        ],
      },
      {
        text: 'Editor',
        items: [
          { text: 'Using the editor', link: '/editor/' },
          { text: 'Styling and theming', link: '/editor/styling' },
          { text: 'Custom layouts', link: '/editor/custom-layouts' },
          { text: 'Translations', link: '/editor/translations' },
        ],
      },
      {
        text: 'AI',
        items: [
          { text: 'Agent tools', link: '/ai/agents' },
          { text: 'AI in the editor', link: '/ai/editor-review' },
          { text: 'MCP server', link: '/ai/mcp' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Blocks', link: '/reference/blocks' },
          { text: 'Editor props and handle', link: '/reference/editor' },
          { text: 'API', link: '/reference/api' },
          { text: 'CLI', link: '/reference/cli' },
        ],
      },
      {
        text: 'More',
        items: [
          { text: 'Migrating from EmailBuilder.js', link: '/guide/migrating' },
          { text: 'Contributing', link: '/contributing' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: repo }],
    editLink: { pattern: `${repo}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
    search: { provider: 'local' },
    outline: [2, 3],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Made by Maildun',
    },
  },
});
