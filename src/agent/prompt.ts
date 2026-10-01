import { z } from 'zod';
import { BLOCK_DEFINITIONS, BLOCK_TYPES } from '../core/schema/blocks';
import { FONT_KEYS, THEME_COLOR_TOKENS } from '../core/schema/primitives';
import { SECTION_NAMES, SECTIONS, type SectionDefinition } from '../core/sections';

type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  description?: string;
  minimum?: number;
  maximum?: number;
};

function describeType(schema: JsonSchema): string {
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join('|');
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  const variants = schema.anyOf ?? schema.oneOf;
  if (variants) return variants.map(describeType).join('|');
  if (schema.type === 'object' && schema.properties) {
    return `{${Object.keys(schema.properties).join(', ')}}`;
  }
  const type = Array.isArray(schema.type) ? schema.type.join('|') : (schema.type ?? 'any');
  if (
    (type === 'number' || type === 'integer') &&
    (schema.minimum !== undefined || schema.maximum !== undefined)
  ) {
    return `${type} ${schema.minimum ?? ''}–${schema.maximum ?? ''}`;
  }
  return type;
}

function describeFields(schema: z.ZodType): string[] {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
  return Object.entries(json.properties ?? {}).map(([name, field]) => {
    const description = field.description ? ` — ${field.description}` : '';
    return `${name}: ${describeType(field)}${description}`;
  });
}

/** Compact reference of every block type: props, style keys and placement. */
export function blockCatalog(): string {
  return BLOCK_TYPES.map((type) => {
    const definition = BLOCK_DEFINITIONS[type];
    const props = describeFields(definition.props);
    const style = describeFields(definition.style).map((line) => line.split(':')[0]);
    return [
      `### ${type}${definition.container ? ' (container: has children)' : ''}`,
      definition.description,
      props.length > 0 ? `props:\n${props.map((line) => `  - ${line}`).join('\n')}` : 'props: none',
      `style keys: ${style.join(', ')}`,
    ].join('\n');
  }).join('\n\n');
}

function sectionCatalog(): string {
  return SECTION_NAMES.map((name) => {
    const section = SECTIONS[name] as SectionDefinition;
    const params = Object.entries(section.params)
      .map(([param, meaning]) => `${param} (${meaning})`)
      .join(', ');
    return `- ${name}: ${section.description} Params: ${params}.`;
  }).join('\n');
}

export interface SystemPromptOptions {
  /** Brand, audience or tone guidance prepended to the rules. */
  brief?: string;
  /** Merge tags the sending platform supports, e.g. `["first_name", "unsubscribe_url"]`. */
  mergeTags?: string[];
  /** Extra rules appended at the end. */
  extra?: string;
}

/**
 * System prompt for an LLM driving the email tools. Includes the block
 * catalog generated from the schemas, so it never drifts from the code.
 */
export function buildSystemPrompt(options: SystemPromptOptions = {}): string {
  const mergeTags = options.mergeTags?.length
    ? `Available merge tags: ${options.mergeTags.map((tag) => `{{ ${tag} }}`).join(', ')}. Use only these.`
    : 'Merge tags look like {{ first_name }}; only use ones the user mentions, plus {{ unsubscribe_url }} in footers.';

  return `You design and edit HTML emails by calling tools that change a structured email document. You never write the email HTML yourself; the renderer produces Outlook-, Gmail- and mobile-safe HTML from the document.
${options.brief ? `\n## Brief\n${options.brief}\n` : ''}
## How to work
1. Call get_document first to see the current outline and block ids.
2. Prefer insert_section for common patterns (${SECTION_NAMES.join(', ')}); then adjust with update_block.
3. Make focused edits with update_block / move_block / remove_block. Use replace_document only to start over.
4. Batch related changes into one call where the tool allows (insert_blocks takes nested blocks; apply_ops takes several operations and is atomic).
5. If a tool returns errors, read the path and hint, fix the input and retry.
6. Finish by calling check_email and fix any warnings that matter (alt text, contrast, placeholder links, unsubscribe link).

## Rules
- Colors: use theme tokens (${THEME_COLOR_TOKENS.map((t) => `$${t}`).join(', ')}) unless the user asks for a specific color; change brand colors with update_theme.
- Fonts: ${FONT_KEYS.join(', ')}, or a CSS font stack. Set them on the theme, not per block, unless asked.
- Text blocks use restricted markdown: paragraphs, line breaks, **bold**, *italic*, ~~strike~~, \`code\`, [links](https://…), "- " and "1. " lists. No headings, tables or images inside text: use heading/image/columns blocks.
- Headings accept inline markdown only (bold, italic, links).
- Links and image URLs must be absolute (https://…), mailto:, tel:, or a merge tag. Never invent real URLs; use https://example.com as a placeholder and say so.
- Every image needs meaningful alt text. Keep emails around 600px wide and under ~100 KB.
- Layout: columns hold 1–4 column blocks and stack on mobile; a column can hold any blocks. Containers group blocks with a shared background, border or padding.
- Padding is a number (all sides) or {top, right, bottom, left}. Use 24px side padding for content blocks so text lines up.
- Ids: blocks you insert may carry your own readable id (e.g. "hero-title") so you can reference them in later calls.
- ${mergeTags}

## Blocks
${blockCatalog()}

## Sections (insert_section)
${sectionCatalog()}
${options.extra ? `\n## Additional instructions\n${options.extra}\n` : ''}`;
}
