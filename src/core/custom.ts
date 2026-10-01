import type { z } from 'zod';
import { type Issue, issuesFromZod } from './issues';
import type { EmailDocument, Theme } from './schema/document';

/** Names look like `product-card`: lowercase letters, digits and dashes. */
export const CUSTOM_BLOCK_NAME = /^[a-z][a-z0-9-]{0,63}$/;

/** One inspector field editing `data[key]` of a custom block. */
export interface CustomBlockField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'image' | 'number' | 'color' | 'switch' | 'select';
  /** For `select`. */
  options?: Array<{ value: string; label: string }>;
  /** For `number`. */
  min?: number;
  max?: number;
  step?: number;
  /** Unit shown after a number, e.g. "px". */
  unit?: string;
  placeholder?: string;
  hint?: string;
}

/** What a custom block's `render` gets besides its data. */
export interface CustomRenderContext {
  theme: Theme;
  /** Resolves theme tokens like `$primary` to colors. */
  color: (value: string | undefined, fallback?: string) => string | undefined;
  /** Resolves a font key (`modern-sans`) or stack to a CSS font stack. */
  font: (value: string | undefined) => string;
  textColor: string;
  linkColor: string;
  fontSize: number;
  lineHeight: number;
  /** Content width available to the block, in px. */
  width: number;
  /** Escapes text for use in HTML content and attribute values. */
  escape: (text: string) => string;
}

/**
 * A block type defined by the host app, e.g. a product card fed from a store.
 * Documents store it as `{ type: "custom", props: { name, data } }`; pass the
 * definitions wherever documents are edited or rendered (`customBlocks`).
 */
export interface CustomBlockDefinition<
  Data extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Stored in documents; never change it once emails use it. */
  name: string;
  label: string;
  /** One sentence, shown in the palette and given to agents. */
  description: string;
  /** Palette group. Defaults to "advanced". */
  category?: 'content' | 'media' | 'layout' | 'advanced';
  /** Validates `data` on every edit (and documents it for agents). */
  schema: z.ZodType<Data>;
  /** Data for a newly inserted block. */
  defaults: Data;
  /**
   * Email-safe HTML for the block's content: tables and inline styles, no
   * scripts. It goes inside the block's padded cell, so don't add outer padding.
   */
  render: (data: Data, ctx: CustomRenderContext) => string;
  /** Plain-text version for the text/plain part of the email. */
  text?: (data: Data) => string;
  /** Inspector fields. Without them the inspector shows a JSON editor. */
  fields?: CustomBlockField[];
  /** Palette icon: a Hugeicons icon (`@hugeicons/core-free-icons`). Editor only. */
  icon?: ReadonlyArray<readonly [string, { readonly [key: string]: string | number }]>;
}

/** The list hosts pass around; definitions with any data type are accepted. */
// biome-ignore lint/suspicious/noExplicitAny: each definition has its own data type.
export type CustomBlocks = ReadonlyArray<CustomBlockDefinition<any>>;

/** Declares a custom block type, checking its name and defaults. */
export function defineBlock<Data extends Record<string, unknown>>(
  definition: CustomBlockDefinition<Data>,
): CustomBlockDefinition<Data> {
  if (!CUSTOM_BLOCK_NAME.test(definition.name)) {
    throw new Error(
      `Invalid custom block name "${definition.name}": use lowercase letters, digits and dashes, starting with a letter.`,
    );
  }
  const defaults = definition.schema.safeParse(definition.defaults);
  if (!defaults.success) {
    throw new Error(
      `The defaults of custom block "${definition.name}" don't match its schema:\n${defaults.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n')}`,
    );
  }
  return definition;
}

/** Looks definitions up by name. */
export function customBlockMap(
  list: CustomBlocks = [],
): ReadonlyMap<string, CustomBlockDefinition> {
  return new Map(list.map((definition) => [definition.name, definition as CustomBlockDefinition]));
}

/**
 * Checks the data of custom blocks against their definitions. Unknown names
 * are reported too, so an agent learns which custom blocks exist.
 */
export function validateCustomBlocks(
  document: EmailDocument,
  customBlocks: CustomBlocks,
  ids: Iterable<string> = Object.keys(document.blocks),
): Issue[] {
  const definitions = customBlockMap(customBlocks);
  const issues: Issue[] = [];
  for (const id of ids) {
    const block = document.blocks[id];
    if (block?.type !== 'custom') continue;
    const definition = definitions.get(block.props.name);
    if (!definition) {
      issues.push({
        path: `blocks.${id}.props.name`,
        message: `Unknown custom block "${block.props.name}".`,
        hint: definitions.size
          ? `Available custom blocks: ${[...definitions.keys()].join(', ')}.`
          : 'No custom blocks are available here.',
        blockId: id,
      });
      continue;
    }
    const parsed = definition.schema.safeParse(block.props.data ?? {});
    if (!parsed.success) {
      issues.push(
        ...issuesFromZod(parsed.error, {
          prefix: `blocks.${id}.props.data`,
          blockId: id,
          blockType: 'custom',
        }),
      );
    }
  }
  return issues;
}
