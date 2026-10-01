import { createDocument } from './ops';
import type { EmailDocument } from './schema/document';
import { buildSection } from './sections';

export interface TemplateDefinition {
  label: string;
  description: string;
  create: () => EmailDocument;
}

export const TEMPLATES = {
  blank: {
    label: 'Blank',
    description: 'An empty canvas.',
    create: () => createDocument(),
  },
  newsletter: {
    label: 'Newsletter',
    description: 'Logo, hero, two articles, features row and footer.',
    create: () =>
      createDocument({
        settings: { preheader: 'This month: what we shipped, what we learned, and what is next.' },
        blocks: [
          buildSection('header', { logoAlt: 'Acme' }),
          buildSection('hero', {
            heading: 'The October update',
            text: 'Three launches, one big lesson, and a sneak peek at what is coming next.',
            buttonText: 'Read the full story',
            imageSrc: 'https://placehold.co/1200x600/png?text=Hero',
            imageAlt: 'Product screenshot',
          }),
          buildSection('article', {
            heading: 'What we shipped',
            text: '- **Faster editor**: loads twice as fast\n- **Smarter search** across every workspace\n- **Dark mode**, finally',
          }),
          buildSection('features'),
          buildSection('cta', { heading: 'Have feedback?', buttonText: 'Reply to this email' }),
          buildSection('footer'),
        ],
      }),
  },
  announcement: {
    label: 'Announcement',
    description: 'A single focused message with one call to action.',
    create: () =>
      createDocument({
        settings: { preheader: 'Something new is here.' },
        blocks: [
          buildSection('header', { logoAlt: 'Acme' }),
          {
            type: 'heading',
            props: { text: 'Introducing something new', level: 1 },
            style: { align: 'center', padding: { top: 32, right: 24, bottom: 8, left: 24 } },
          },
          {
            type: 'text',
            props: {
              markdown:
                'Hi {{ first_name }},\n\nWe built this because you asked for it. Here is what changes for you starting today.',
            },
          },
          {
            type: 'button',
            props: { text: 'See what is new', href: 'https://example.com' },
            style: { align: 'center', padding: { top: 16, right: 24, bottom: 32, left: 24 } },
          },
          buildSection('footer'),
        ],
      }),
  },
} satisfies Record<string, TemplateDefinition>;

export type TemplateName = keyof typeof TEMPLATES;
