import type { AgentTool, JsonSchema } from './tools';

/** Tool definitions for the Anthropic Messages API (`tools` parameter). */
export function toAnthropicTools(tools: AgentTool[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as { type: 'object'; [key: string]: unknown },
  }));
}

export interface OpenAIToolsOptions {
  /**
   * Run every schema through `simplifySchema`, for OpenAI-compatible APIs that
   * accept only a subset of JSON Schema (Gemini, xAI …).
   */
  simpleSchemas?: boolean;
}

/** Tool definitions for OpenAI-compatible chat completions APIs. */
export function toOpenAITools(tools: AgentTool[], options: OpenAIToolsOptions = {}) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: options.simpleSchemas ? simplifySchema(tool.inputSchema) : tool.inputSchema,
    },
  }));
}

/** Tool definitions in Model Context Protocol (`tools/list`) shape, with titles and annotations. */
export function toMcpTools(tools: AgentTool[]) {
  return tools.map((tool) => ({
    name: tool.name,
    ...(tool.title ? { title: tool.title } : {}),
    description: tool.description,
    inputSchema: tool.inputSchema,
    ...(tool.annotations ? { annotations: tool.annotations } : {}),
  }));
}

const UNSUPPORTED_KEYS = new Set(['$schema', '$defs', 'propertyNames', 'additionalProperties']);

/**
 * Rewrites a tool schema for APIs that reject parts of JSON Schema: inlines
 * `$ref`s two levels deep (deeper ones become a plain block object), and drops
 * `$schema`, `$defs`, `propertyNames`, `additionalProperties` and
 * `minimum`/`maximum` values outside the 32-bit range.
 */
export function simplifySchema(schema: JsonSchema): JsonSchema {
  const defs = (schema.$defs ?? {}) as Record<string, JsonSchema>;

  const visit = (node: unknown, depth: number): unknown => {
    if (Array.isArray(node)) return node.map((item) => visit(item, depth));
    if (!node || typeof node !== 'object') return node;

    const record = node as Record<string, unknown>;
    if (typeof record.$ref === 'string') {
      const target = defs[record.$ref.replace('#/$defs/', '')];
      return target && depth < 2
        ? visit(target, depth + 1)
        : { type: 'object', description: 'A block: { type, props, style?, children? }.' };
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (UNSUPPORTED_KEYS.has(key)) continue;
      if ((key === 'maximum' || key === 'minimum') && Math.abs(Number(value)) > 2 ** 31) continue;
      result[key] =
        key === 'properties'
          ? Object.fromEntries(
              Object.entries(value as Record<string, unknown>).map(([name, child]) => [
                name,
                visit(child, depth),
              ]),
            )
          : visit(value, depth);
    }
    return result;
  };

  return visit(schema, 0) as JsonSchema;
}
