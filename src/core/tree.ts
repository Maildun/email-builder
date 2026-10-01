import { createUniqueId } from './ids';
import { type Issue, issuesFromZod, joinPath } from './issues';
import {
  BLOCK_DEFINITIONS,
  type Block,
  type BlockType,
  canContain,
  hasChildren,
} from './schema/blocks';
import { type BlockInput, BlockInputSchema, type EmailDocument, ROOT_ID } from './schema/document';

export type ParentType = BlockType | 'root';

export interface NormalizeResult {
  ids: string[];
  blocks: Record<string, Block>;
  issues: Issue[];
}

/**
 * Turns nested block input into flat blocks with ids and defaults filled in.
 * `taken` holds ids already used by the document and is extended in place.
 */
export function normalizeBlockInputs(
  inputs: unknown[],
  options: { parentType: ParentType; taken: Set<string>; path: string; opIndex?: number },
): NormalizeResult {
  const result: NormalizeResult = { ids: [], blocks: {}, issues: [] };

  inputs.forEach((raw, index) => {
    const path = joinPath(options.path, index);
    const parsed = BlockInputSchema.safeParse(raw);
    if (!parsed.success) {
      const blockType =
        typeof raw === 'object' && raw !== null && 'type' in raw ? String(raw.type) : undefined;
      result.issues.push(
        ...issuesFromZod(parsed.error, {
          prefix: path,
          ...(blockType ? { blockType } : {}),
          ...(options.opIndex !== undefined ? { opIndex: options.opIndex } : {}),
        }),
      );
      return;
    }
    const id = addBlock(
      parsed.data,
      options.parentType,
      options.taken,
      path,
      result,
      options.opIndex,
    );
    if (id) {
      result.ids.push(id);
    }
  });

  return result;
}

function addBlock(
  input: BlockInput,
  parentType: ParentType,
  taken: Set<string>,
  path: string,
  result: NormalizeResult,
  opIndex: number | undefined,
): string | undefined {
  const withOp = opIndex !== undefined ? { opIndex } : {};

  if (!canContain(parentType, input.type)) {
    result.issues.push({
      path: joinPath(path, 'type'),
      message: `A "${input.type}" block cannot be placed inside ${parentType === ROOT_ID ? 'the document body' : `a "${parentType}" block`}.`,
      hint: placementHint(parentType, input.type),
      ...withOp,
    });
    return undefined;
  }

  let id: string;
  if (input.id !== undefined) {
    if (taken.has(input.id)) {
      result.issues.push({
        path: joinPath(path, 'id'),
        message: `Id "${input.id}" is already used.`,
        hint: 'Pick a different id or omit it to have one generated.',
        ...withOp,
      });
      return undefined;
    }
    taken.add(input.id);
    id = input.id;
  } else {
    id = createUniqueId(taken);
  }

  const definition = BLOCK_DEFINITIONS[input.type];
  const props = { ...definition.defaults.props, ...(input.props ?? {}) };
  const style = { ...definition.defaults.style, ...(input.style ?? {}) };

  if (!definition.container) {
    if (input.children && input.children.length > 0) {
      result.issues.push({
        path: joinPath(path, 'children'),
        message: `A "${input.type}" block cannot have children.`,
        hint: 'Wrap related blocks in a "container" instead.',
        ...withOp,
      });
      return undefined;
    }
    result.blocks[id] = { type: input.type, props, style } as Block;
    return id;
  }

  let children = input.children ?? [];
  if (input.type === 'columns') {
    children = children.map((child) =>
      child.type === 'column' ? child : { type: 'column', children: [child] },
    );
    if (children.length === 0) {
      children = [{ type: 'column' }, { type: 'column' }];
    }
    if (children.length > 4) {
      result.issues.push({
        path: joinPath(path, 'children'),
        message: `A columns block holds 1–4 columns; got ${children.length}.`,
        hint: 'Split the content into two columns blocks.',
        ...withOp,
      });
      return undefined;
    }
  }

  const childIds: string[] = [];
  children.forEach((child, index) => {
    const childId = addBlock(
      child,
      input.type,
      taken,
      joinPath(path, 'children', index),
      result,
      opIndex,
    );
    if (childId) {
      childIds.push(childId);
    }
  });

  result.blocks[id] = { type: input.type, props, style, children: childIds } as Block;
  return id;
}

function placementHint(parentType: ParentType, childType: BlockType): string {
  if (childType === 'column') {
    return 'Columns only go directly inside a "columns" block.';
  }
  if (parentType === 'columns') {
    return 'Put content inside one of its "column" children.';
  }
  return 'Only "container", "column" and the document body accept children.';
}

/** Rebuilds the nested input form of a block (with ids), e.g. for agents or duplication. */
export function toBlockInput(document: EmailDocument, id: string, keepIds = true): BlockInput {
  const block = document.blocks[id];
  if (!block) {
    throw new Error(`Block "${id}" does not exist.`);
  }
  const input: Record<string, unknown> = { type: block.type, props: structuredClone(block.props) };
  if (keepIds) {
    input.id = id;
  }
  if (block.style && Object.keys(block.style).length > 0) {
    input.style = structuredClone(block.style);
  }
  if (hasChildren(block)) {
    input.children = block.children.map((childId) => toBlockInput(document, childId, keepIds));
  }
  return input as BlockInput;
}

export interface ParentInfo {
  parentId: string;
  index: number;
}

/** Finds the parent of a block; `parentId` is `"root"` for top-level blocks. */
export function findParent(document: EmailDocument, id: string): ParentInfo | undefined {
  const rootIndex = document.root.indexOf(id);
  if (rootIndex !== -1) {
    return { parentId: ROOT_ID, index: rootIndex };
  }
  for (const [parentId, block] of Object.entries(document.blocks)) {
    if (hasChildren(block)) {
      const index = block.children.indexOf(id);
      if (index !== -1) {
        return { parentId, index };
      }
    }
  }
  return undefined;
}

/** Child id list of a parent (`"root"` = document body). */
export function childrenOf(document: EmailDocument, parentId: string): string[] | undefined {
  if (parentId === ROOT_ID) {
    return document.root;
  }
  const block = document.blocks[parentId];
  return block && hasChildren(block) ? block.children : undefined;
}

/** The block and all its descendants, depth first. */
export function descendantIds(document: EmailDocument, id: string): string[] {
  const ids: string[] = [];
  const visit = (current: string) => {
    ids.push(current);
    const block = document.blocks[current];
    if (block && hasChildren(block)) {
      block.children.forEach(visit);
    }
  };
  visit(id);
  return ids;
}

/** Ids of the block's ancestors, nearest first (excluding `"root"`). */
export function ancestorIds(document: EmailDocument, id: string): string[] {
  const ids: string[] = [];
  let current = findParent(document, id);
  while (current && current.parentId !== ROOT_ID) {
    ids.push(current.parentId);
    current = findParent(document, current.parentId);
  }
  return ids;
}

/** Walks the tree in document order. */
export function walk(
  document: EmailDocument,
  visit: (id: string, block: Block, depth: number, parentId: string) => void,
): void {
  const recurse = (ids: string[], depth: number, parentId: string) => {
    for (const id of ids) {
      const block = document.blocks[id];
      if (!block) {
        continue;
      }
      visit(id, block, depth, parentId);
      if (hasChildren(block)) {
        recurse(block.children, depth + 1, id);
      }
    }
  };
  recurse(document.root, 0, ROOT_ID);
}
