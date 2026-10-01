import Anthropic from '@anthropic-ai/sdk';
import type { Plugin } from 'vite';
import {
  buildSystemPrompt,
  createAgentSession,
  outlineDocument,
  runTool,
  toAnthropicTools,
} from '../src/agent';
import type { EmailDocument } from '../src/core/schema/document';
import { validateDocument } from '../src/core/validate';

const MODEL = 'claude-opus-5-5';
const MAX_TURNS = 16;

interface AgentRequestBody {
  prompt: string;
  document: EmailDocument;
  selectedId: string | null;
  mergeTags?: string[];
}

async function readJson(request: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/**
 * Runs Claude against the email tools on the server and returns the ops it
 * applied, so the editor can show them as a reviewable proposal.
 */
async function runAgent(body: AgentRequestBody) {
  const client = new Anthropic();
  const session = createAgentSession(body.document, { lint: { requireUnsubscribe: true } });
  const tools = toAnthropicTools(session.tools);
  const system = buildSystemPrompt({
    ...(body.mergeTags ? { mergeTags: body.mergeTags } : {}),
    brief:
      'You are working inside a visual editor; the user reviews your changes before they are applied.',
  });

  const selection = body.selectedId
    ? `\nThe user has block "${body.selectedId}" selected; "this" or "it" most likely refers to it.`
    : '';
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: `Current email:\n${outlineDocument(body.document)}${selection}\n\nRequest: ${body.prompt}`,
    },
  ];

  let summary = '';
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system,
      tools,
      messages,
      output_config: { effort: 'medium' },
      cache_control: { type: 'ephemeral' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });

    if (response.stop_reason === 'refusal') {
      throw new Error('The model declined this request.');
    }

    messages.push({ role: 'assistant', content: response.content });
    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    if (text) summary = text;

    if (response.stop_reason === 'pause_turn') continue;
    if (response.stop_reason !== 'tool_use') break;

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = response.content
      .filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use')
      .map((block) => {
        const result = runTool(session.tools, block.name, block.input);
        return {
          type: 'tool_result',
          tool_use_id: block.id,
          content: result.content,
          ...(result.ok ? {} : { is_error: true }),
        };
      });
    messages.push({ role: 'user', content: results });
  }

  return { ops: session.ops, summary };
}

export function agentMiddleware(): Plugin {
  return {
    name: 'email-builder-agent',
    configureServer(server) {
      server.middlewares.use('/api/agent', async (request, response) => {
        const send = (status: number, payload: unknown) => {
          response.statusCode = status;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(payload));
        };
        if (request.method !== 'POST') {
          send(405, { error: 'POST only' });
          return;
        }
        try {
          const body = (await readJson(request)) as AgentRequestBody;
          if (typeof body.prompt !== 'string' || !validateDocument(body.document).ok) {
            send(400, { error: 'Expected { prompt, document }.' });
            return;
          }
          send(200, await runAgent(body));
        } catch (error) {
          if (error instanceof Anthropic.AuthenticationError) {
            send(401, {
              error:
                'No Anthropic credentials. Set ANTHROPIC_API_KEY or run `ant auth login`, then restart the playground.',
            });
          } else if (error instanceof Anthropic.RateLimitError) {
            send(429, { error: 'Rate limited by the Anthropic API. Try again shortly.' });
          } else if (error instanceof Anthropic.APIError) {
            send(502, { error: `Anthropic API error ${error.status}: ${error.message}` });
          } else if (error instanceof Anthropic.AnthropicError) {
            send(401, {
              error: `${error.message} Set ANTHROPIC_API_KEY or run \`ant auth login\`, then restart the playground.`,
            });
          } else {
            send(500, { error: (error as Error).message });
          }
        }
      });
    },
  };
}
