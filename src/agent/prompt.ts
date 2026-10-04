import { z } from 'zod';
import type { CustomBlocks } from '../core/custom';
import { BLOCK_DEFINITIONS, BLOCK_TYPES, type BlockType, canContain } from '../core/schema/blocks';
import { FONT_KEYS, THEME_COLOR_TOKENS } from '../core/schema/primitives';
import {
  SECTION_NAMES,
  SECTIONS,
  type SectionDefinition,
  type SectionName,
} from '../core/sections';
import { TEMPLATES, type TemplateName } from '../core/templates';

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

/** Everything about one block type: props and style with their types, defaults and placement. */
export function blockReference(type: BlockType): string {
  const definition = BLOCK_DEFINITIONS[type];
  const parents = (['root', ...BLOCK_TYPES] as const).filter((parent) =>
    parent === 'root' || BLOCK_DEFINITIONS[parent].container ? canContain(parent, type) : false,
  );
  const children = definition.container
    ? BLOCK_TYPES.filter((child) => canContain(type, child))
    : [];
  const props = describeFields(definition.props);
  return [
    `### ${type} (${definition.label})`,
    definition.description,
    props.length > 0 ? `props:\n${props.map((line) => `  - ${line}`).join('\n')}` : 'props: none',
    `style:\n${describeFields(definition.style)
      .map((line) => `  - ${line}`)
      .join('\n')}`,
    `defaults: ${JSON.stringify(definition.defaults)}`,
    `goes in: ${parents.join(', ')}`,
    children.length > 0 ? `holds: ${children.join(', ')}` : 'holds: nothing (not a container)',
  ].join('\n');
}

/** One section: what it builds and the parameters it takes. */
export function sectionReference(name: SectionName): string {
  const section = SECTIONS[name] as SectionDefinition;
  return [
    `### ${name} (${section.label})`,
    section.description,
    `params (all optional strings):\n${Object.entries(section.params)
      .map(([param, meaning]) => `  - ${param}: ${meaning}`)
      .join('\n')}`,
  ].join('\n');
}

/** The starting templates for new emails. */
export function templateCatalog(): string {
  return (Object.keys(TEMPLATES) as TemplateName[])
    .map((name) => `- ${name}: ${TEMPLATES[name].description}`)
    .join('\n');
}

export function sectionCatalog(): string {
  return SECTION_NAMES.map((name) => {
    const section = SECTIONS[name] as SectionDefinition;
    const params = Object.entries(section.params)
      .map(([param, meaning]) => `${param} (${meaning})`)
      .join(', ');
    return `- ${name}: ${section.description} Params: ${params}.`;
  }).join('\n');
}

/** Reference for the host's custom blocks: name, purpose and data schema. */
export function customBlockCatalog(customBlocks: CustomBlocks): string {
  return customBlocks
    .map((definition) => {
      const schema = z.toJSONSchema(definition.schema, { unrepresentable: 'any' });
      delete (schema as { $schema?: string }).$schema;
      return [
        `### ${definition.name}`,
        definition.description,
        `data schema: ${JSON.stringify(schema)}`,
        `example: ${JSON.stringify({ type: 'custom', props: { name: definition.name, data: definition.defaults } })}`,
      ].join('\n');
    })
    .join('\n\n');
}

export interface SystemPromptOptions {
  /** Brand, audience or tone guidance prepended to the rules. */
  brief?: string;
  /** Custom blocks the agent may use (pass the same list to the tools). */
  customBlocks?: CustomBlocks;
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
1. Call get_document first to see the current outline and block ids. Call get_reference for the full props of a block type or the params of a section when you're unsure.
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

${
  options.customBlocks?.length
    ? `\n## Custom blocks\nThis app adds its own block types. Insert them as {type: "custom", props: {name, data}}; data must match the schema. Prefer them over html blocks when they fit.\n\n${customBlockCatalog(options.customBlocks)}\n`
    : ''
}
## Sections (insert_section)
${sectionCatalog()}
${options.extra ? `\n## Additional instructions\n${options.extra}\n` : ''}`;
}
