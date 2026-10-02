# Agent tools

The agent module lets any LLM design and edit emails. It's provider-neutral: it gives you **tools** and a **system prompt**, and you bring the model.

```ts
import {
  buildSystemPrompt,
  createAgentSession,
  runTool,
  toAnthropicTools,
  toOpenAITools,
} from '@maildun/email-builder/agent';
```

The model never writes HTML. It calls tools that change the document, every call is validated, and a rejected call tells the model exactly what to fix (`Rejected, nothing changed. Fix these and retry: …`). The renderer then produces the email-safe HTML.

## A complete loop

::: code-group

```ts [Anthropic]
import Anthropic from '@anthropic-ai/sdk';
import { createDocument } from '@maildun/email-builder';
import { buildSystemPrompt, createAgentSession, runTool, toAnthropicTools } from '@maildun/email-builder/agent';

const session = createAgentSession(createDocument(), { lint: { requireUnsubscribe: true } });
const client = new Anthropic();
const messages: Anthropic.MessageParam[] = [
  { role: 'user', content: 'Write a welcome email for a coffee roaster' },
];

while (true) {
  const response = await client.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    system: buildSystemPrompt({ mergeTags: ['first_name', 'unsubscribe_url'] }),
    tools: toAnthropicTools(session.tools),
    messages,
  });
  messages.push({ role: 'assistant', content: response.content });
  if (response.stop_reason !== 'tool_use') break;

  messages.push({
    role: 'user',
    content: response.content
      .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
      .map((block): Anthropic.ToolResultBlockParam => {
        const result = runTool(session.tools, block.name, block.input);
        return { type: 'tool_result', tool_use_id: block.id, content: result.content, is_error: !result.ok };
      }),
  });
}

session.getDocument(); // the new design
session.ops;           // the operations, replayable as an editor proposal
```

```ts [OpenAI-compatible]
import OpenAI from 'openai';
import { createDocument } from '@maildun/email-builder';
import { buildSystemPrompt, createAgentSession, runTool, toOpenAITools } from '@maildun/email-builder/agent';

const session = createAgentSession(createDocument());
const client = new OpenAI();
const messages: OpenAI.ChatCompletionMessageParam[] = [
  { role: 'system', content: buildSystemPrompt() },
  { role: 'user', content: 'Write a welcome email for a coffee roaster' },
];

while (true) {
  const response = await client.chat.completions.create({
    model: 'your-model',
    tools: toOpenAITools(session.tools),
    messages,
  });
  const message = response.choices[0].message;
  messages.push(message);
  if (!message.tool_calls?.length) break;

  for (const call of message.tool_calls) {
    if (call.type !== 'function') continue;
    const result = runTool(session.tools, call.function.name, JSON.parse(call.function.arguments));
    messages.push({ role: 'tool', tool_call_id: call.id, content: result.content });
  }
}

session.getDocument();
```

:::

## Tools

| Tool | What it does |
| --- | --- |
| `get_document` | The outline: settings, theme colors and every block as `id type: summary`. |
| `get_block` | One block with all its props, style and nested children as JSON. |
| `insert_blocks` | Inserts blocks (with nested children) into a parent. Returns the new ids. |
| `update_block` | Changes props and/or style of a block. Only the given keys change. |
| `move_block` | Moves a block (with its children) to another parent or position. |
| `remove_block` | Deletes a block and everything inside it. |
| `duplicate_block` | Copies a block (with its children) right after itself. |
| `replace_block` | Replaces a block in place with new content. |
| `insert_section` | Inserts a ready-made [section](/guide/sections). |
| `update_settings` | Changes settings such as preheader, width or colors. |
| `update_theme` | Changes theme colors and fonts; every block using `$tokens` follows. |
| `replace_document` | Replaces the whole email with new blocks. For starting over. |
| `apply_ops` | Applies several [operations](/guide/operations) atomically. |
| `check_email` | Validates the email and returns lint warnings plus the plain-text version. |

Every tool has `name`, `description`, `inputSchema` (JSON Schema) and `execute(input)`. `runTool(tools, name, input)` finds and runs one, and returns `{ ok, content, data? }`: `content` is the text for the model, `data` structured details for you (new ids, issues).

**Adapters** shape the tools for each API: `toAnthropicTools`, `toOpenAITools` and `toMcpTools`.

## The system prompt

`buildSystemPrompt()` explains how to work with the tools and includes a block and section catalog **generated from the schemas**, so it never drifts from the code.

```ts
buildSystemPrompt({
  brief: 'Acme sells specialty coffee. Warm, short, no exclamation marks.', // prepended
  mergeTags: ['first_name', 'unsubscribe_url'], // the only tags the model may use
  customBlocks: [productCard],                  // documents your custom blocks
  extra: 'Always end with the footer section.', // appended
});
```

`blockCatalog()` and `customBlockCatalog()` return just the catalogs, if you write your own prompt.

## Sessions and stores

`createAgentSession(document, options)` keeps a document in memory, which suits servers and tests:

| Member | Description |
| --- | --- |
| `tools` | The tools, bound to the session's document |
| `getDocument()` | The current document |
| `ops` | Every operation applied, in order, with explicit ids |
| `changed` | Ids of blocks changed during the session |

To bind the tools to your own storage instead, use `createAgentTools(store, options)` with any object that has `getDocument()` and `setDocument(document, { ops, changed })`, for example one that writes to your database on every change.

Options for both:

| Option | Description |
| --- | --- |
| `lint` | [Lint options](/guide/validation#lint) for `check_email`, e.g. `{ requireUnsubscribe: true }`. |
| `customBlocks` | Custom block types the agent may insert. Their data is validated on every change. |
| `strictSchemas` | Use the full JSON Schema for nested blocks in tool inputs instead of the compact one. Costs about 7k more tokens per request; the system prompt already documents every block. |

## Tips

- Show the user the result with the editor: replay `session.ops` with `editor.propose(ops)` so they can review the changes. Or run the loop against `editor.tools()` directly, see [AI in the editor](./editor-review).
- Ask the model to call `check_email` before it finishes. Lint warnings like missing alt text or a missing unsubscribe link are written so it can fix them.
- Run the loop on your server so your API key stays secret, then send the operations to the browser.
