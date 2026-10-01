import type { AgentTool } from './tools';

/** Tool definitions for the Anthropic Messages API (`tools` parameter). */
export function toAnthropicTools(tools: AgentTool[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as { type: 'object'; [key: string]: unknown },
  }));
}

/** Tool definitions for OpenAI-compatible chat completions APIs. */
export function toOpenAITools(tools: AgentTool[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
  }));
}

/** Tool definitions in Model Context Protocol (`tools/list`) shape. */
export function toMcpTools(tools: AgentTool[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}
