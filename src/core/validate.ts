import { type Issue, issuesFromZod } from './issues';
import { BLOCK_DEFINITIONS, type BlockType, canContain, hasChildren } from './schema/blocks';
import { DocumentSchema, type EmailDocument, ROOT_ID } from './schema/document';

export type ValidationResult =
  | { ok: true; document: EmailDocument; issues: [] }
  | { ok: false; issues: Issue[] };

/**
 * Checks the schema and the tree: every child exists, every block has exactly
 * one parent, no cycles, no orphans, and parent/child types are compatible.
 */
export function validateDocument(input: unknown): ValidationResult {
  const parsed = DocumentSchema.safeParse(input);
  if (!parsed.success) {
    const blocks =
      typeof input === 'object' && input !== null && 'blocks' in input
        ? (input.blocks as Record<string, { type?: unknown }>)
        : {};
    const issues = parsed.error.issues.flatMap((zodIssue) => {
      const [first, blockId] = zodIssue.path;
      const blockType =
        first === 'blocks' && typeof blockId === 'string' ? blocks[blockId]?.type : undefined;
      return issuesFromZod({ issues: [zodIssue] } as never, {
        ...(typeof blockType === 'string' ? { blockType } : {}),
        ...(first === 'blocks' && typeof blockId === 'string' ? { blockId } : {}),
      });
    });
    return { ok: false, issues };
  }

  const issues = validateStructure(parsed.data);
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, document: parsed.data, issues: [] };
}

export function validateStructure(document: EmailDocument): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();

  const visit = (ids: string[], parentId: string, parentType: BlockType | 'root', path: string) => {
    ids.forEach((id, index) => {
      const at = `${path}.${index}`;
      const block = document.blocks[id];
      if (!block) {
        issues.push({
          path: at,
          message: `Child "${id}" does not exist in blocks.`,
          blockId: parentId,
        });
        return;
      }
      if (seen.has(id)) {
        issues.push({
          path: at,
          message: `Block "${id}" appears more than once in the tree (or forms a cycle).`,
          hint: 'Each block must have exactly one parent; duplicate it instead of reusing its id.',
          blockId: id,
        });
        return;
      }
      seen.add(id);
      if (!canContain(parentType, block.type)) {
        issues.push({
          path: at,
          message: `A "${block.type}" block cannot be inside ${parentType === ROOT_ID ? 'the document body' : `a "${parentType}" block`}.`,
          blockId: id,
        });
      }
      const definition = BLOCK_DEFINITIONS[block.type];
      if (definition.container !== hasChildren(block)) {
        issues.push({
          path: `blocks.${id}.children`,
          message: definition.container
            ? `A "${block.type}" block needs a children array.`
            : `A "${block.type}" block cannot have children.`,
          blockId: id,
        });
      }
      if (block.type === 'columns' && (block.children.length < 1 || block.children.length > 4)) {
        issues.push({
          path: `blocks.${id}.children`,
          message: `A columns block holds 1–4 columns; got ${block.children.length}.`,
          blockId: id,
        });
      }
      if (hasChildren(block)) {
        visit(block.children, id, block.type, `blocks.${id}.children`);
      }
    });
  };

  visit(document.root, ROOT_ID, 'root', 'root');

  for (const id of Object.keys(document.blocks)) {
    if (id === ROOT_ID) {
      issues.push({
        path: `blocks.${id}`,
        message: `"${ROOT_ID}" is reserved for the document body.`,
      });
    } else if (!seen.has(id)) {
      issues.push({
        path: `blocks.${id}`,
        message: `Block "${id}" is not attached to the tree (orphan).`,
        hint: 'Remove it or reference it from a parent.',
        blockId: id,
      });
    }
  }

  return issues;
}
