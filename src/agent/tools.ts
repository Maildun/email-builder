import { z } from 'zod';
import type { CustomBlocks } from '../core/custom';
import { formatIssues, type Issue } from '../core/issues';
import { type LintOptions, lintDocument } from '../core/lint';
import { type ApplyResult, applyOpsMaterialized, type Op } from '../core/ops';
import { BLOCK_TYPES } from '../core/schema/blocks';
import {
  type BlockInput,
  BlockInputSchema,
  type EmailDocument,
  ROOT_ID,
} from '../core/schema/document';
import { buildSection, SECTION_NAMES, type SectionName } from '../core/sections';
import { toBlockInput } from '../core/tree';
import { renderEmail } from '../render/html';
import { outlineDocument, summarizeBlock } from './outline';

export type JsonSchema = Record<string, unknown>;

export interface ToolResult {
  /** False when the call was rejected; `content` then explains how to fix it. */
  ok: boolean;
  /** Text for the model. */
  content: string;
  /** Structured result for hosts (inserted ids, issues …). */
  data?: unknown;
}

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (input: unknown) => ToolResult;
}

export interface DocumentStore {
  getDocument: () => EmailDocument;
  /** Receives every successful change along with the ops that produced it. */
  setDocument: (document: EmailDocument, change: { ops: Op[]; changed: string[] }) => void;
}

export interface AgentToolsOptions {
  /** Options for the lint run in `check_email`. */
  lint?: LintOptions;
  /**
   * Use the full, strict JSON Schema for nested blocks in tool inputs instead
   * of the compact one (the system prompt already documents every block).
   * Strict schemas cost ~7k extra tokens per request.
   */
  strictSchemas?: boolean;
  /** Custom block types the agent may insert; their data is validated on every change. */
  customBlocks?: CustomBlocks;
}

/** Loose block shape for tool schemas; full validation happens on apply. */
const LooseBlock: z.ZodType = z.lazy(() =>
  z.object({
    id: z.string().optional().describe('Optional readable id, e.g. "hero-title".'),
    type: z.enum(BLOCK_TYPES as [string, ...string[]]),
    props: z.record(z.string(), z.unknown()).optional(),
    style: z.record(z.string(), z.unknown()).optional(),
    children: z.array(LooseBlock).optional().describe('Nested blocks, for container types only.'),
  }),
);

const Patch = z
  .record(z.string(), z.unknown())
  .describe('Keys to set; null removes a key so the default applies.');

function inputSchemas(strict: boolean) {
  const block = strict ? (BlockInputSchema as z.ZodType) : LooseBlock;
  const parent = z
    .string()
    .describe(`Container, column or "${ROOT_ID}" (document body). Default "${ROOT_ID}".`);
  const index = z.number().int().min(0).describe('Position among siblings; omit to append.');

  return {
    get_document: z.object({}),
    get_block: z.object({ id: z.string() }),
    insert_blocks: z.object({
      parentId: parent.optional(),
      index: index.optional(),
      blocks: z.array(block).min(1),
    }),
    update_block: z.object({ id: z.string(), props: Patch.optional(), style: Patch.optional() }),
    move_block: z.object({ id: z.string(), parentId: parent, index: index.optional() }),
    remove_block: z.object({ id: z.string() }),
    duplicate_block: z.object({ id: z.string() }),
    replace_block: z.object({ id: z.string(), block }),
    insert_section: z.object({
      name: z.enum(SECTION_NAMES as [string, ...string[]]),
      params: z
        .record(z.string(), z.string())
        .optional()
        .describe('Section parameters; see the system prompt.'),
      parentId: parent.optional(),
      index: index.optional(),
    }),
    update_settings: z.object({
      settings: Patch.describe(
        'width, preheader, title, lang, padding, backdropColor, canvasColor, textColor, linkColor, borderColor, borderRadius, fontSize, lineHeight',
      ),
    }),
    update_theme: z.object({
      colors: Patch.optional().describe(
        'primary, secondary, text, muted, background, surface, border, link (hex only)',
      ),
      fonts: Patch.optional().describe('body, heading'),
    }),
    replace_document: z.object({
      settings: Patch.optional(),
      theme: z.object({ colors: Patch.optional(), fonts: Patch.optional() }).optional(),
      blocks: z.array(block),
    }),
    apply_ops: z.object({
      ops: z
        .array(z.record(z.string(), z.unknown()))
        .min(1)
        .describe(
          'Atomic batch. Each op is one of: {op:"insert", parentId?, index?, blocks}, {op:"update", id, props?, style?}, {op:"move", id, parentId, index?}, {op:"remove", id}, {op:"duplicate", id}, {op:"replace", id, block}, {op:"updateSettings", settings}, {op:"updateTheme", colors?, fonts?}.',
        ),
    }),
    check_email: z.object({}),
  };
}

const DESCRIPTIONS: Record<keyof ReturnType<typeof inputSchemas>, string> = {
  get_document:
    'Returns the outline of the email: settings, theme colors and every block as "id type: summary".',
  get_block: 'Returns one block with all its props, style and nested children as JSON.',
  insert_blocks:
    'Inserts one or more blocks (with nested children) into a parent. Returns the new ids.',
  update_block: 'Changes props and/or style of a block. Only the given keys change.',
  move_block: 'Moves a block (with its children) to another parent or position.',
  remove_block: 'Deletes a block and everything inside it.',
  duplicate_block: 'Copies a block (with its children) right after itself.',
  replace_block: 'Replaces a block, keeping its position, with new block content.',
  insert_section: 'Inserts a ready-made section (see the section list in the system prompt).',
  update_settings: 'Changes email settings such as preheader, width or colors.',
  update_theme: 'Changes theme colors and fonts; every block using $tokens follows.',
  replace_document: 'Replaces the whole email with new blocks. Use only to start from scratch.',
  apply_ops:
    'Applies several operations atomically: all succeed or none do. When any fail, every failing op is reported (op numbers are 0-based) so you can fix them in one retry.',
  check_email:
    'Validates the email and returns warnings (accessibility, deliverability, placeholders) plus the plain-text version.',
};

function failure(issues: Issue[]): ToolResult {
  return {
    ok: false,
    content: `Rejected, nothing changed. Fix these and retry:\n${formatIssues(issues)}`,
    data: { issues },
  };
}

/**
 * Creates provider-neutral tools that let an LLM read and edit an email
 * document. Hand them to any SDK with `toAnthropicTools`, `toOpenAITools` or
 * `toMcpTools`, and route tool calls back to `execute`.
 */
export function createAgentTools(
  store: DocumentStore,
  options: AgentToolsOptions = {},
): AgentTool[] {
  const schemas = inputSchemas(options.strictSchemas ?? false);

  const commit = (
    ops: Op[],
    describe: (result: Extract<ApplyResult, { ok: true }>) => string,
  ): ToolResult => {
    const result = applyOpsMaterialized(store.getDocument(), ops, {
      ...(options.customBlocks ? { customBlocks: options.customBlocks } : {}),
    });
    if (!result.ok) {
      return failure(result.issues);
    }
    store.setDocument(result.document, { ops: result.ops, changed: result.changed });
    return {
      ok: true,
      content: describe(result),
      data: { inserted: result.inserted, changed: result.changed, removed: result.removed },
    };
  };

  const describeInserted = (result: Extract<ApplyResult, { ok: true }>) => {
    const lines = result.inserted.map((id) => {
      const block = result.document.blocks[id];
      return block ? `- ${id} ${block.type}: ${summarizeBlock(block)}` : `- ${id}`;
    });
    return `Inserted ${result.inserted.length} block(s):\n${lines.join('\n')}`;
  };

  const handlers: Record<keyof typeof schemas, (input: never) => ToolResult> = {
    get_document: () => ({ ok: true, content: outlineDocument(store.getDocument()) }),

    get_block: (input: { id: string }) => {
      const document = store.getDocument();
      if (!document.blocks[input.id]) {
        return failure([
          {
            path: 'id',
            message: `Block "${input.id}" does not exist.`,
            hint: 'Call get_document for valid ids.',
          },
        ]);
      }
      const block = toBlockInput(document, input.id);
      return { ok: true, content: JSON.stringify(block, null, 2), data: block };
    },

    insert_blocks: (input: { parentId?: string; index?: number; blocks: BlockInput[] }) =>
      commit([{ op: 'insert', ...input }], describeInserted),

    update_block: (input: {
      id: string;
      props?: Record<string, unknown>;
      style?: Record<string, unknown>;
    }) =>
      commit([{ op: 'update', ...input }], (result) => {
        const block = result.document.blocks[input.id];
        return `Updated ${input.id}${block ? ` (${block.type}: ${summarizeBlock(block)})` : ''}.`;
      }),

    move_block: (input: { id: string; parentId: string; index?: number }) =>
      commit([{ op: 'move', ...input }], () => `Moved ${input.id} into ${input.parentId}.`),

    remove_block: (input: { id: string }) =>
      commit(
        [{ op: 'remove', id: input.id }],
        (result) => `Removed ${result.removed.length} block(s).`,
      ),

    duplicate_block: (input: { id: string }) =>
      commit([{ op: 'duplicate', id: input.id }], describeInserted),

    replace_block: (input: { id: string; block: BlockInput }) =>
      commit([{ op: 'replace', ...input }], describeInserted),

    insert_section: (input: {
      name: SectionName;
      params?: Record<string, string>;
      parentId?: string;
      index?: number;
    }) =>
      commit(
        [
          {
            op: 'insert',
            ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
            ...(input.index !== undefined ? { index: input.index } : {}),
            blocks: [buildSection(input.name, input.params)],
          },
        ],
        describeInserted,
      ),

    update_settings: (input: { settings: Record<string, unknown> }) =>
      commit([{ op: 'updateSettings', settings: input.settings }], () => 'Settings updated.'),

    update_theme: (input: { colors?: Record<string, unknown>; fonts?: Record<string, unknown> }) =>
      commit([{ op: 'updateTheme', ...input }], () => 'Theme updated.'),

    replace_document: (input: {
      settings?: Record<string, unknown>;
      theme?: unknown;
      blocks: BlockInput[];
    }) =>
      commit(
        [{ op: 'replaceDocument', document: input }],
        (result) => `Document replaced.\n${outlineDocument(result.document)}`,
      ),

    apply_ops: (input: { ops: Op[] }) =>
      commit(input.ops, (result) =>
        [
          `Applied ${input.ops.length} operation(s).`,
          result.inserted.length > 0 ? describeInserted(result) : '',
          result.removed.length > 0 ? `Removed: ${result.removed.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      ),

    check_email: () => {
      const document = store.getDocument();
      const warnings = lintDocument(document, options.lint);
      const rendered = renderEmail(document, {
        ...(options.customBlocks ? { customBlocks: options.customBlocks } : {}),
      });
      const all = [
        ...warnings.map(
          (w) => `- [${w.severity}] ${w.blockId ? `${w.blockId}: ` : ''}${w.message} (${w.code})`,
        ),
        ...rendered.warnings.map((w) => `- [warning] ${w.message} (${w.code})`),
      ];
      return {
        ok: true,
        content: [
          all.length > 0 ? `Warnings:\n${all.join('\n')}` : 'No warnings.',
          `HTML size: ${Math.round(rendered.html.length / 1024)} KB`,
          `Plain text:\n${rendered.text}`,
        ].join('\n\n'),
        data: { warnings, renderWarnings: rendered.warnings },
      };
    },
  };

  return (Object.keys(schemas) as Array<keyof typeof schemas>).map((name) => {
    const schema = schemas[name];
    return {
      name,
      description: DESCRIPTIONS[name],
      inputSchema: z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema,
      execute: (input: unknown) => {
        const parsed = schema.safeParse(input ?? {});
        if (!parsed.success) {
          return failure(
            parsed.error.issues.map((issue) => ({
              path: issue.path.map(String).join('.'),
              message: issue.message,
            })),
          );
        }
        return (handlers[name] as (input: unknown) => ToolResult)(parsed.data);
      },
    };
  });
}

/** Runs a tool by name; unknown names return a helpful failure instead of throwing. */
export function runTool(tools: AgentTool[], name: string, input: unknown): ToolResult {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    return {
      ok: false,
      content: `Unknown tool "${name}". Available: ${tools.map((t) => t.name).join(', ')}.`,
    };
  }
  return tool.execute(input);
}

export interface AgentSession extends DocumentStore {
  tools: AgentTool[];
  /** Every op that was applied, in order (useful to replay as an editor proposal). */
  readonly ops: Op[];
  /** Ids of blocks changed during the session. */
  readonly changed: Set<string>;
}

/** In-memory document + tools, for servers and tests. */
export function createAgentSession(
  initial: EmailDocument,
  options: AgentToolsOptions = {},
): AgentSession {
  let document = initial;
  const ops: Op[] = [];
  const changed = new Set<string>();
  const session: AgentSession = {
    getDocument: () => document,
    setDocument: (next, change) => {
      document = next;
      ops.push(...change.ops);
      for (const id of change.changed) changed.add(id);
    },
    tools: [],
    ops,
    changed,
  };
  session.tools = createAgentTools(session, options);
  return session;
}
