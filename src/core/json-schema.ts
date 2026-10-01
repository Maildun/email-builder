import { z } from 'zod';
import { OpSchema } from './ops';
import { BlockInputSchema, DocumentSchema } from './schema/document';

type JsonSchema = Record<string, unknown>;

const cache = new Map<string, JsonSchema>();

function toJson(key: string, schema: z.ZodType): JsonSchema {
  let json = cache.get(key);
  if (!json) {
    json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
    cache.set(key, json);
  }
  return json;
}

/** JSON Schema of a stored document. */
export function documentJsonSchema(): JsonSchema {
  return toJson('document', DocumentSchema);
}

/** JSON Schema of nested block input (what agents send to `insert`). */
export function blockInputJsonSchema(): JsonSchema {
  return toJson('blockInput', BlockInputSchema);
}

/** JSON Schema of a single operation. */
export function opJsonSchema(): JsonSchema {
  return toJson('op', OpSchema);
}
