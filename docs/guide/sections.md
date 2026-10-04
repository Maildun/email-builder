# Sections and templates

## Sections

Sections are ready-made groups of blocks for patterns every email uses: a header, a hero, a footer. People add them from the editor's palette; agents add them with the `insert_section` tool; you build them in code with `buildSection`.

```ts
import { buildSection, createDocument } from '@maildun/email-builder';

const doc = createDocument({
  blocks: [
    buildSection('header', { logoSrc: 'https://acme.com/logo.png', logoAlt: 'Acme' }),
    buildSection('hero', {
      heading: 'Our spring sale',
      text: 'Everything you love, up to **40% off**.',
      buttonText: 'Shop the sale',
      href: 'https://acme.com/sale',
      imageSrc: 'https://acme.com/spring.jpg',
      imageAlt: 'Spring flowers',
    }),
    buildSection('footer', { company: 'Acme Inc.', address: '1 Main St, Springfield' }),
  ],
});
```

All parameters are optional strings; anything you leave out gets sensible placeholder content. Sections are made of ordinary blocks, so you can edit every part afterwards.

| Name | Description | Parameters |
| --- | --- | --- |
| `header` | Centered logo at the top of the email. | `logoSrc`, `logoAlt`, `href` |
| `navHeader` | Logo on the left and a few text links on the right. | `logoSrc`, `logoAlt`, `href`, `links` (markdown links separated by ` · `) |
| `hero` | Large image, headline, supporting copy and a primary button. | `heading`, `text`, `buttonText`, `href`, `imageSrc` (omit for no image), `imageAlt` |
| `article` | A heading followed by body copy. | `heading`, `text` |
| `features` | Three columns with a short title and text each; stacks on mobile. | `title1`–`title3`, `text1`–`text3` |
| `imageText` | An image beside a heading, copy and a button; stacks on mobile. | `heading`, `text`, `buttonText` (omit for no button), `href`, `imageSrc`, `imageAlt`, `imageSide` (`left`, the default, or `right`) |
| `cards` | Two side-by-side cards with an image, title, text and link. | `title1`, `text1`, `href1`, `imageSrc1`, `title2`, `text2`, `href2`, `imageSrc2`, `buttonText` |
| `gallery` | A 2×2 grid of images. | `imageSrc1`–`imageSrc4` |
| `testimonial` | A customer quote with their photo, name and role. | `quote`, `name`, `role`, `avatarSrc` |
| `promo` | A discount code in a dashed box with a button to redeem it. | `heading`, `code`, `text`, `buttonText`, `href` |
| `signoff` | A personal closing line with the sender's photo, name and title. | `closing`, `name`, `role`, `avatarSrc` |
| `cta` | Highlighted band with a heading and a button. | `heading`, `buttonText`, `href` |
| `footer` | Social icons and muted small print with company details and the unsubscribe link. | `company`, `address`, `socialLinks` (profile URLs separated by spaces; `""` for none) |

`SECTIONS` holds each definition (`label`, `description`, `params`, `build`) and `SECTION_NAMES` lists the names. To limit what the editor's palette offers, pass [`sections`](/reference/editor#props) to `<EmailEditor>`.

## Templates

Templates are whole documents to start from:

| Name | Description |
| --- | --- |
| `blank` | An empty canvas. |
| `newsletter` | Logo, hero, an article, a features row, a call to action and footer. |
| `announcement` | A single focused message with one call to action. |

```ts
import { TEMPLATES } from '@maildun/email-builder';

const doc = TEMPLATES.announcement.create();
```

Each call returns a fresh document. Your own templates are just stored documents: save a design and load it into the editor as a starting point.
