import { z } from 'zod';
import { emptyDocument } from './defaults';
import { createUniqueId } from './ids';
import { aliasHint, type Issue, issuesFromZod, joinPath } from './issues';
import { type Block, BlockSchema, canContain, hasChildren } from './schema/blocks';
import {
  type BlockInput,
  BlockInputSchema,
  type EmailDocument,
  ROOT_ID,
  SettingsSchema,
  ThemeSchema,
} from './schema/document';
import {
  childrenOf,
  descendantIds,
  findParent,
  normalizeBlockInputs,
  type ParentType,
  toBlockInput,
} from './tree';
import { validateDocument } from './validate';

const IdSchema = z.string().min(1).describe('Id of an existing block.');
const ParentIdSchema = z
  .string()
  .min(1)
  .describe(`Id of the container, column or "${ROOT_ID}" for the document body.`);
const IndexSchema = z
  .number()
  .int()
  .min(0)
  .describe("Position among the parent's children. Omit to append at the end.");
const PatchSchema = z
  .record(z.string(), z.unknown())
  .describe('Keys to set. Use null to remove a key and fall back to the default.');

export const InsertOpSchema = z.strictObject({
  op: z.literal('insert'),
  parentId: ParentIdSchema.optional(),
  index: IndexSchema.optional(),
  blocks: z.array(BlockInputSchema).min(1),
});

export const UpdateOpSchema = z.strictObject({
  op: z.literal('update'),
  id: IdSchema,
  props: PatchSchema.optional(),
  style: PatchSchema.optional(),
});

export const MoveOpSchema = z.strictObject({
  op: z.literal('move'),
  id: IdSchema,
  parentId: ParentIdSchema,
  index: IndexSchema.optional(),
});

export const RemoveOpSchema = z.strictObject({ op: z.literal('remove'), id: IdSchema });

export const DuplicateOpSchema = z.strictObject({ op: z.literal('duplicate'), id: IdSchema });

export const ReplaceOpSchema = z.strictObject({
  op: z.literal('replace'),
  id: IdSchema,
  block: BlockInputSchema,
});

export const UpdateSettingsOpSchema = z.strictObject({
  op: z.literal('updateSettings'),
  settings: PatchSchema,
});

export const UpdateThemeOpSchema = z.strictObject({
  op: z.literal('updateTheme'),
  colors: PatchSchema.optional(),
  fonts: PatchSchema.optional(),
});

export const ReplaceDocumentOpSchema = z.strictObject({
  op: z.literal('replaceDocument'),
  document: z
    .unknown()
    .describe(
      'Either a full document, or {settings?, theme?, blocks: BlockInput[]} to rebuild the body from nested blocks.',
    ),
});

export const OpSchema = z.discriminatedUnion('op', [
  InsertOpSchema,
  UpdateOpSchema,
  MoveOpSchema,
  RemoveOpSchema,
  DuplicateOpSchema,
  ReplaceOpSchema,
  UpdateSettingsOpSchema,
  UpdateThemeOpSchema,
  ReplaceDocumentOpSchema,
]);

export type InsertOp = { op: 'insert'; parentId?: string; index?: number; blocks: BlockInput[] };
export type UpdateOp = {
  op: 'update';
  id: string;
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
};
export type MoveOp = { op: 'move'; id: string; parentId: string; index?: number };
export type RemoveOp = { op: 'remove'; id: string };
export type DuplicateOp = { op: 'duplicate'; id: string };
export type ReplaceOp = { op: 'replace'; id: string; block: BlockInput };
export type UpdateSettingsOp = { op: 'updateSettings'; settings: Record<string, unknown> };
export type UpdateThemeOp = {
  op: 'updateTheme';
  colors?: Record<string, unknown>;
  fonts?: Record<string, unknown>;
};
export type ReplaceDocumentOp = { op: 'replaceDocument'; document: unknown };

export type Op =
  | InsertOp
  | UpdateOp
  | MoveOp
  | RemoveOp
  | DuplicateOp
  | ReplaceOp
  | UpdateSettingsOp
  | UpdateThemeOp
  | ReplaceDocumentOp;

export type ApplyResult =
  | {
      ok: true;
      document: EmailDocument;
      /** Blocks whose content, style or position changed (including new ones). */
      changed: string[];
      inserted: string[];
      removed: string[];
    }
  | { ok: false; issues: Issue[] };

class OpError extends Error {
  constructor(readonly issues: Issue[]) {
    super(issues.map((issue) => issue.message).join('\n'));
  }
}

interface Draft {
  document: EmailDocument;
  changed: Set<string>;
  inserted: Set<string>;
  removed: Set<string>;
}

/**
 * Applies operations atomically: either every op succeeds and the result is a
 * valid document, or the original document is untouched and issues explain why.
 */
export function applyOps(document: EmailDocument, ops: Op | Op[]): ApplyResult {
  const list = Array.isArray(ops) ? ops : [ops];
  const draft: Draft = {
    document: structuredClone(document),
    changed: new Set(),
    inserted: new Set(),
    removed: new Set(),
  };

  try {
    list.forEach((raw, opIndex) => {
      const parsed = OpSchema.safeParse(raw);
      if (!parsed.success) {
        throw new OpError(issuesFromZod(parsed.error, { opIndex }));
      }
      applyOne(draft, parsed.data as Op, opIndex);
    });
  } catch (error) {
    if (error instanceof OpError) {
      return { ok: false, issues: error.issues };
    }
    throw error;
  }

  const validation = validateDocument(draft.document);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues };
  }

  for (const id of draft.removed) {
    draft.changed.delete(id);
  }
  return {
    ok: true,
    document: shareUnchanged(document, validation.document),
    changed: [...draft.changed],
    inserted: [...draft.inserted],
    removed: [...draft.removed],
  };
}

/** Structural equality for JSON-like values (documents contain nothing else). */
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) =>
    jsonEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

/**
 * Reuses the previous objects for every part of the document that didn't
 * change, so an edit to one block keeps every other block (and the theme and
 * settings) referentially equal. UIs can then skip re-rendering them.
 */
function shareUnchanged(previous: EmailDocument, next: EmailDocument): EmailDocument {
  const blocks: EmailDocument['blocks'] = {};
  for (const [id, block] of Object.entries(next.blocks)) {
    const before = previous.blocks[id];
    blocks[id] = before && jsonEqual(before, block) ? before : block;
  }
  return {
    ...next,
    root: jsonEqual(previous.root, next.root) ? previous.root : next.root,
    theme: jsonEqual(previous.theme, next.theme) ? previous.theme : next.theme,
    settings: jsonEqual(previous.settings, next.settings) ? previous.settings : next.settings,
    blocks,
  };
}

function fail(issue: Issue): never {
  throw new OpError([issue]);
}

function parentTypeOf(document: EmailDocument, parentId: string, opIndex: number): ParentType {
  if (parentId === ROOT_ID) {
    return 'root';
  }
  const parent = document.blocks[parentId];
  if (!parent) {
    fail({ path: 'parentId', message: `Parent "${parentId}" does not exist.`, opIndex });
  }
  if (!hasChildren(parent)) {
    fail({
      path: 'parentId',
      message: `"${parentId}" is a "${parent.type}" block and cannot hold children.`,
      hint: 'Insert into a container, a column, or "root".',
      opIndex,
    });
  }
  return parent.type;
}

function requireBlock(document: EmailDocument, id: string, opIndex: number): Block {
  const block = document.blocks[id];
  if (!block) {
    fail({ path: 'id', message: `Block "${id}" does not exist.`, opIndex });
  }
  return block;
}

function clampIndex(index: number | undefined, length: number): number {
  return index === undefined ? length : Math.min(Math.max(index, 0), length);
}

function applyOne(draft: Draft, op: Op, opIndex: number): void {
  const doc = draft.document;
  switch (op.op) {
    case 'insert': {
      const parentId = op.parentId ?? ROOT_ID;
      const parentType = parentTypeOf(doc, parentId, opIndex);
      const normalized = normalizeBlockInputs(op.blocks, {
        parentType,
        taken: new Set([ROOT_ID, ...Object.keys(doc.blocks)]),
        path: 'blocks',
        opIndex,
      });
      if (normalized.issues.length > 0) {
        throw new OpError(normalized.issues);
      }
      Object.assign(doc.blocks, normalized.blocks);
      const siblings = childrenOf(doc, parentId) ?? [];
      siblings.splice(clampIndex(op.index, siblings.length), 0, ...normalized.ids);
      for (const id of Object.keys(normalized.blocks)) {
        draft.inserted.add(id);
        draft.changed.add(id);
      }
      if (parentId !== ROOT_ID) {
        draft.changed.add(parentId);
      }
      return;
    }

    case 'update': {
      const block = requireBlock(doc, op.id, opIndex);
      const next = structuredClone(block) as Block & { style?: Record<string, unknown> };
      patch(next.props as Record<string, unknown>, op.props);
      if (op.style) {
        next.style = next.style ?? {};
        patch(next.style, op.style);
      }
      const parsed = BlockSchema.safeParse(next);
      if (!parsed.success) {
        throw new OpError(
          issuesFromZod(parsed.error, { blockType: block.type, blockId: op.id, opIndex }).map(
            (issue) => ({ ...issue, hint: issue.hint ?? keyHint(block.type, issue.path) }),
          ),
        );
      }
      doc.blocks[op.id] = parsed.data;
      draft.changed.add(op.id);
      return;
    }

    case 'move': {
      const block = requireBlock(doc, op.id, opIndex);
      const parentType = parentTypeOf(doc, op.parentId, opIndex);
      if (op.parentId !== ROOT_ID && descendantIds(doc, op.id).includes(op.parentId)) {
        fail({
          path: 'parentId',
          message: 'A block cannot be moved into itself or its descendants.',
          opIndex,
        });
      }
      if (!canContain(parentType, block.type)) {
        fail({
          path: 'parentId',
          message: `A "${block.type}" block cannot be placed inside ${parentType === 'root' ? 'the document body' : `a "${parentType}" block`}.`,
          opIndex,
        });
      }
      const from = findParent(doc, op.id);
      if (!from) {
        fail({ path: 'id', message: `Block "${op.id}" is not attached to the tree.`, opIndex });
      }
      const source = childrenOf(doc, from.parentId) ?? [];
      source.splice(from.index, 1);
      const target = childrenOf(doc, op.parentId) ?? [];
      target.splice(clampIndex(op.index, target.length), 0, op.id);
      draft.changed.add(op.id);
      if (from.parentId !== ROOT_ID) draft.changed.add(from.parentId);
      if (op.parentId !== ROOT_ID) draft.changed.add(op.parentId);
      return;
    }

    case 'remove': {
      requireBlock(doc, op.id, opIndex);
      const parent = findParent(doc, op.id);
      if (parent) {
        if (parent.parentId !== ROOT_ID) {
          const parentBlock = doc.blocks[parent.parentId];
          if (parentBlock?.type === 'columns' && parentBlock.children.length === 1) {
            fail({
              path: 'id',
              message: 'Cannot remove the last column of a columns block.',
              hint: `Remove the columns block "${parent.parentId}" instead.`,
              opIndex,
            });
          }
          draft.changed.add(parent.parentId);
        }
        childrenOf(doc, parent.parentId)?.splice(parent.index, 1);
      }
      for (const id of descendantIds(doc, op.id)) {
        delete doc.blocks[id];
        draft.removed.add(id);
        draft.inserted.delete(id);
      }
      return;
    }

    case 'duplicate': {
      requireBlock(doc, op.id, opIndex);
      const parent = findParent(doc, op.id);
      if (!parent) {
        fail({ path: 'id', message: `Block "${op.id}" is not attached to the tree.`, opIndex });
      }
      applyOne(
        draft,
        {
          op: 'insert',
          parentId: parent.parentId,
          index: parent.index + 1,
          blocks: [toBlockInput(doc, op.id, false)],
        },
        opIndex,
      );
      return;
    }

    case 'replace': {
      requireBlock(doc, op.id, opIndex);
      const parent = findParent(doc, op.id);
      if (!parent) {
        fail({ path: 'id', message: `Block "${op.id}" is not attached to the tree.`, opIndex });
      }
      const removed = descendantIds(doc, op.id);
      for (const id of removed) {
        delete doc.blocks[id];
      }
      childrenOf(doc, parent.parentId)?.splice(parent.index, 1);
      const block = { ...op.block, id: op.block.id ?? op.id } as BlockInput;
      applyOne(
        draft,
        { op: 'insert', parentId: parent.parentId, index: parent.index, blocks: [block] },
        opIndex,
      );
      for (const id of removed) {
        if (!doc.blocks[id]) {
          draft.removed.add(id);
        }
      }
      return;
    }

    case 'updateSettings': {
      const next = structuredClone(doc.settings) as Record<string, unknown>;
      patch(next, op.settings);
      const parsed = SettingsSchema.safeParse(next);
      if (!parsed.success) {
        throw new OpError(issuesFromZod(parsed.error, { prefix: 'settings', opIndex }));
      }
      doc.settings = parsed.data;
      return;
    }

    case 'updateTheme': {
      const next = structuredClone(doc.theme);
      patch(next.colors as Record<string, unknown>, op.colors, false);
      patch(next.fonts as Record<string, unknown>, op.fonts, false);
      const parsed = ThemeSchema.safeParse(next);
      if (!parsed.success) {
        throw new OpError(issuesFromZod(parsed.error, { prefix: 'theme', opIndex }));
      }
      doc.theme = parsed.data;
      return;
    }

    case 'replaceDocument': {
      const next = buildDocument(op.document, opIndex);
      for (const id of Object.keys(doc.blocks)) {
        if (!next.blocks[id]) draft.removed.add(id);
      }
      for (const id of Object.keys(next.blocks)) {
        draft.changed.add(id);
        if (!doc.blocks[id]) draft.inserted.add(id);
      }
      draft.document = next;
      return;
    }
  }
}

function patch(
  target: Record<string, unknown>,
  changes: Record<string, unknown> | undefined,
  allowRemove = true,
): void {
  if (!changes) {
    return;
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === null && allowRemove) {
      delete target[key];
    } else {
      target[key] = value;
    }
  }
}

function keyHint(blockType: string, path: string): string | undefined {
  const key = path.split('.').pop();
  return key ? aliasHint(blockType, key) : undefined;
}

const TreeDocumentSchema = z.strictObject({
  settings: z.record(z.string(), z.unknown()).optional(),
  theme: z
    .strictObject({
      colors: z.record(z.string(), z.unknown()).optional(),
      fonts: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  blocks: z.array(z.unknown()),
});

function buildDocument(input: unknown, opIndex: number): EmailDocument {
  if (typeof input === 'object' && input !== null && 'version' in input) {
    const validation = validateDocument(input);
    if (!validation.ok) {
      throw new OpError(
        validation.issues.map((issue) => ({
          ...issue,
          opIndex,
          path: joinPath('document', issue.path),
        })),
      );
    }
    return structuredClone(validation.document);
  }

  const parsed = TreeDocumentSchema.safeParse(input);
  if (!parsed.success) {
    throw new OpError(issuesFromZod(parsed.error, { prefix: 'document', opIndex }));
  }
  const base = emptyDocument();
  const draft: Draft = {
    document: base,
    changed: new Set(),
    inserted: new Set(),
    removed: new Set(),
  };
  if (parsed.data.settings) {
    applyOne(draft, { op: 'updateSettings', settings: parsed.data.settings }, opIndex);
  }
  if (parsed.data.theme) {
    applyOne(draft, { op: 'updateTheme', ...parsed.data.theme }, opIndex);
  }
  if (parsed.data.blocks.length > 0) {
    const normalized = normalizeBlockInputs(parsed.data.blocks, {
      parentType: 'root',
      taken: new Set([ROOT_ID]),
      path: 'document.blocks',
      opIndex,
    });
    if (normalized.issues.length > 0) {
      throw new OpError(normalized.issues);
    }
    draft.document.blocks = normalized.blocks;
    draft.document.root = normalized.ids;
  }
  return draft.document;
}

/** Creates a document, optionally from nested blocks and partial settings/theme. */
export function createDocument(
  input: {
    settings?: Record<string, unknown>;
    theme?: { colors?: Record<string, unknown>; fonts?: Record<string, unknown> };
    blocks?: BlockInput[];
  } = {},
): EmailDocument {
  const result = applyOps(emptyDocument(), {
    op: 'replaceDocument',
    document: { ...input, blocks: input.blocks ?? [] },
  });
  if (!result.ok) {
    throw new Error(
      `Invalid document input:\n${result.issues.map((i) => `${i.path}: ${i.message}`).join('\n')}`,
    );
  }
  return result.document;
}

function assignIds(input: BlockInput, taken: Set<string>): BlockInput {
  const id = input.id ?? createUniqueId(taken);
  taken.add(id);
  const children = input.children?.map((child) => assignIds(child, taken));
  return { ...input, id, ...(children ? { children } : {}) } as BlockInput;
}

/**
 * Returns an equivalent op in which every block it creates has an explicit
 * id, so replaying it (e.g. as an editor proposal) yields identical ids.
 * `duplicate` becomes an `insert` of the copied subtree.
 */
export function materializeOp(document: EmailDocument, op: Op): Op {
  const taken = new Set([ROOT_ID, ...Object.keys(document.blocks)]);
  const blocksOf = (value: unknown): value is { blocks: unknown[] } =>
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { blocks?: unknown }).blocks);
  switch (op.op) {
    case 'insert':
      return { ...op, blocks: op.blocks.map((block) => assignIds(block, taken)) };
    case 'replace':
      return {
        ...op,
        block: assignIds({ ...op.block, id: op.block.id ?? op.id } as BlockInput, taken),
      };
    case 'duplicate': {
      const parent = findParent(document, op.id);
      if (!document.blocks[op.id] || !parent) return op;
      return {
        op: 'insert',
        parentId: parent.parentId,
        index: parent.index + 1,
        blocks: [assignIds(toBlockInput(document, op.id, false), taken)],
      };
    }
    case 'replaceDocument': {
      if (!blocksOf(op.document) || 'version' in (op.document as object)) return op;
      const fresh = new Set([ROOT_ID]);
      return {
        ...op,
        document: {
          ...op.document,
          blocks: op.document.blocks.map((block) =>
            typeof block === 'object' && block !== null && 'type' in block
              ? assignIds(block as BlockInput, fresh)
              : block,
          ),
        },
      };
    }
    default:
      return op;
  }
}

/**
 * Applies ops one at a time, materializing ids first. The returned `ops`
 * replay to exactly the same document.
 */
export function applyOpsMaterialized(
  document: EmailDocument,
  ops: Op[],
): (Extract<ApplyResult, { ok: true }> & { ops: Op[] }) | Extract<ApplyResult, { ok: false }> {
  let current = document;
  const materialized: Op[] = [];
  const changed = new Set<string>();
  const inserted = new Set<string>();
  const removed = new Set<string>();
  for (const [index, raw] of ops.entries()) {
    const parsed = OpSchema.safeParse(raw);
    const op = parsed.success ? materializeOp(current, parsed.data as Op) : raw;
    const result = applyOps(current, op);
    if (!result.ok) {
      return { ok: false, issues: result.issues.map((issue) => ({ ...issue, opIndex: index })) };
    }
    materialized.push(op);
    current = result.document;
    for (const id of result.changed) changed.add(id);
    for (const id of result.inserted) inserted.add(id);
    for (const id of result.removed) {
      removed.add(id);
      changed.delete(id);
      inserted.delete(id);
    }
  }
  return {
    ok: true,
    document: current,
    changed: [...changed],
    inserted: [...inserted],
    removed: [...removed],
    ops: materialized,
  };
}
