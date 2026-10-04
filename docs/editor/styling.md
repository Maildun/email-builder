# Styling and theming

The editor UI is built with [shadcn/ui](https://ui.shadcn.com) (Base UI primitives) and Tailwind CSS. Pick the stylesheet that fits your app.

## Any React app: `styles.css`

Everything is precompiled. Rules are scoped to the editor, so they never touch the rest of your page, and you don't need Tailwind.

```ts
import '@maildun/email-builder/styles.css';
```

Theme it with `--meb-*` variables (shadcn's token names with a `meb-` prefix), on `.meb-root` or any ancestor:

```css
:root {
  --meb-primary: oklch(0.55 0.22 263);
  --meb-radius: 0.75rem;
  --meb-font: 'Inter', sans-serif;
}
.dark {
  --meb-primary: oklch(0.7 0.16 263);
}
```

| Token | Description |
| --- | --- |
| `background`, `foreground` | Panels and their text |
| `card`, `popover` (+ `-foreground`) | Raised surfaces and menus |
| `primary`, `secondary`, `muted`, `accent` (+ `-foreground`) | shadcn's usual roles |
| `destructive` | Delete actions |
| `border`, `input`, `ring` | Lines, fields and focus rings |
| `radius` | Base corner radius |
| `font` | UI font |
| `selection`, `selection-soft`, `selection-solid` | The selected block's outline, fill, and the solid color behind white text |
| `ai`, `ai-soft` | Highlights for AI proposals |
| `stage` | Background behind the email canvas |
| `code-tag`, `code-attr`, `code-string`, `code-keyword`, `code-entity`, `code-comment`, `code-merge` | Syntax colors in the Code view (light and dark defaults included) |

## Tailwind CSS 4 + shadcn/ui apps: `core.css`

Your app compiles the editor's classes, so the editor uses your theme (colors, radius, fonts, dark mode) and your Tailwind build. It expects the standard shadcn setup:

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import 'shadcn/tailwind.css';
@import '@maildun/email-builder/core.css';
@source '../node_modules/@maildun/email-builder/dist';
```

Adjust the `@source` path so it points at the package's `dist` folder from your CSS file.

## Dark mode

Dark mode follows a `dark` class on an ancestor (the shadcn convention). Use the `appearance` prop to change that:

| `appearance` | Behavior |
| --- | --- |
| `'inherit'` (default) | Dark when an ancestor has the `dark` class |
| `'light'` / `'dark'` | Always light / dark |
| `'system'` | Follows the OS setting |

The email canvas always shows the email's own colors, because that's what recipients see.

Browser dark-mode tools (Dark Reader, Chrome's auto dark mode) recolor every page, including the email preview and color swatches. If your app has its own dark mode, tell them so:

```html
<meta name="color-scheme" content="light dark" />
<meta name="darkreader-lock" />
```

## Customizing parts

Each part of the editor has a `data-slot` attribute and accepts extra classes through `classNames`:

```tsx
<EmailEditor classNames={{ sidebar: 'w-72', canvas: 'bg-slate-50' }} />
```

Slots: `root`, `topbar`, `sidebar`, `stage`, `canvas`, `inspector`, `proposal`, `block-toolbar`.

For anything else, target the slots in CSS loaded after the editor's stylesheet:

```css
[data-slot='topbar'] {
  height: 56px;
}
.meb-block[data-selected]::after {
  box-shadow: inset 0 0 0 2px hotpink;
}
```

The email canvas resets your page's global styles inside it, so what you see matches what recipients get.
