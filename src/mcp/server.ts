import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { version } from '../../package.json';
import { toMcpTools } from '../agent/adapters';
import { buildSystemPrompt } from '../agent/prompt';
import { type AgentTool, createAgentTools, type ToolResult } from '../agent/tools';
import { formatIssues } from '../core/issues';
import { lintDocument } from '../core/lint';
import type { EmailDocument } from '../core/schema/document';
import { TEMPLATES, type TemplateName } from '../core/templates';
import { validateDocument } from '../core/validate';
import { renderEmail } from '../render/html';

/** Protocol revisions this server speaks, newest first. */
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const WORKFLOW = `## Files
You work on email documents stored as JSON files in the user's folder.
- Start with list_emails, then open_email (or create_email for a new one). The editing tools act on the open email and save it to its file after every successful change.
- render_email writes the sendable HTML next to the JSON file; mention its path when you're done.
- The same files open in the visual editor (@maildun/email-builder), so keep ids readable.`;

export interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface McpServerOptions {
  /** Folder the email files live in; paths outside it are refused. Defaults to the cwd. */
  dir?: string;
  /** Asset base URL for rendered social icons (see `RenderOptions.assetsUrl`). */
  assetsUrl?: string;
}

function ok(content: string, data?: unknown): ToolResult {
  return { ok: true, content, ...(data === undefined ? {} : { data }) };
}

function fail(content: string): ToolResult {
  return { ok: false, content };
}

/**
 * A Model Context Protocol server that lets AI clients (Claude Desktop, Claude
 * Code, Cursor …) design emails in a folder of JSON documents, with the same
 * tools the agent module gives your own models. Transport-agnostic: feed it
 * parsed JSON-RPC messages; `serveStdio` wires it to stdin/stdout.
 */
export class EmailMcpServer {
  readonly dir: string;
  private readonly assetsUrl: string | undefined;
  private file: string | null = null;
  private document: EmailDocument | null = null;
  private readonly tools: AgentTool[];

  constructor(options: McpServerOptions = {}) {
    this.dir = resolve(options.dir ?? process.cwd());
    this.assetsUrl = options.assetsUrl;
    const editing = createAgentTools({
      getDocument: () => this.document as EmailDocument,
      setDocument: (document) => {
        this.document = document;
        this.save();
      },
    }).map((tool) => ({
      ...tool,
      execute: (input: unknown) =>
        this.document
          ? tool.execute(input)
          : fail('No email is open. Call open_email or create_email first.'),
    }));
    this.tools = [...this.fileTools(), ...editing];
  }

  /** Handles one JSON-RPC message; returns the response, or null for notifications. */
  handle(message: JsonRpcMessage): JsonRpcMessage | null {
    const { id, method, params = {} } = message;
    if (id === undefined || id === null) return null; // Notifications need no reply.
    const reply = (result: unknown) => ({ jsonrpc: '2.0' as const, id, result });
    switch (method) {
      case 'initialize': {
        const requested = String(params.protocolVersion ?? '');
        return reply({
          protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
          capabilities: { tools: {} },
          serverInfo: { name: 'email-builder', title: 'Email builder', version },
          instructions: buildSystemPrompt({ extra: WORKFLOW }),
        });
      }
      case 'ping':
        return reply({});
      case 'tools/list':
        return reply({ tools: toMcpTools(this.tools) });
      case 'tools/call': {
        const tool = this.tools.find((candidate) => candidate.name === params.name);
        const result = tool
          ? this.run(tool, params.arguments ?? {})
          : fail(`Unknown tool "${String(params.name)}".`);
        return reply({ content: [{ type: 'text', text: result.content }], isError: !result.ok });
      }
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${String(method)}` },
        };
    }
  }

  private run(tool: AgentTool, input: unknown): ToolResult {
    try {
      return tool.execute(input);
    } catch (error) {
      return fail((error as Error).message);
    }
  }

  /** Resolves a path inside the folder, or explains why it can't be used. */
  private path(file: unknown, extension = '.json'): string | ToolResult {
    if (typeof file !== 'string' || !file.trim())
      return fail('Give a file path, e.g. "welcome.json".');
    const path = resolve(this.dir, extname(file) ? file : `${file}${extension}`);
    if (path !== this.dir && !path.startsWith(this.dir + sep)) {
      return fail(`"${file}" is outside the email folder (${this.dir}).`);
    }
    return path;
  }

  private open(path: string, document: EmailDocument): void {
    this.file = path;
    this.document = document;
  }

  private save(): void {
    if (!this.file || !this.document) return;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, `${JSON.stringify(this.document, null, 2)}\n`);
  }

  private relative(path: string): string {
    return relative(this.dir, path) || '.';
  }

  private fileTools(): AgentTool[] {
    const templates = Object.keys(TEMPLATES) as TemplateName[];
    return [
      {
        name: 'list_emails',
        description: 'Lists the email documents (JSON files) in the folder.',
        inputSchema: { type: 'object', properties: {} },
        execute: () => {
          const found: string[] = [];
          const walk = (folder: string, depth: number) => {
            for (const entry of readdirSync(folder, { withFileTypes: true })) {
              if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
              const path = join(folder, entry.name);
              if (entry.isDirectory() && depth < 3) walk(path, depth + 1);
              else if (entry.isFile() && entry.name.endsWith('.json') && found.length < 200) {
                try {
                  if (validateDocument(JSON.parse(readFileSync(path, 'utf8'))).ok) {
                    found.push(this.relative(path));
                  }
                } catch {
                  // Not JSON, or not an email document.
                }
              }
            }
          };
          walk(this.dir, 0);
          return ok(
            found.length
              ? `Emails in ${this.dir}:\n${found.map((file) => `- ${file}`).join('\n')}`
              : `No email documents in ${this.dir} yet. Use create_email.`,
            { files: found },
          );
        },
      },
      {
        name: 'create_email',
        description: `Creates a new email file and opens it. Templates: ${templates.join(', ')}.`,
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string', description: 'Path in the folder, e.g. "spring-sale.json".' },
            template: {
              type: 'string',
              enum: templates,
              description: 'Starting point (default blank).',
            },
          },
          required: ['file'],
        },
        execute: (input) => {
          const { file, template = 'blank' } = (input ?? {}) as {
            file?: unknown;
            template?: string;
          };
          const path = this.path(file);
          if (typeof path !== 'string') return path;
          if (existsSync(path))
            return fail(`${this.relative(path)} already exists; open it instead.`);
          const definition = TEMPLATES[template as TemplateName];
          if (!definition)
            return fail(`Unknown template "${template}". Use one of: ${templates.join(', ')}.`);
          this.open(path, definition.create());
          this.save();
          return ok(`Created and opened ${this.relative(path)} from the ${template} template.`);
        },
      },
      {
        name: 'open_email',
        description: 'Opens an email file; the editing tools then act on it and save to it.',
        inputSchema: {
          type: 'object',
          properties: { file: { type: 'string', description: 'Path in the folder.' } },
          required: ['file'],
        },
        execute: (input) => {
          const path = this.path((input as { file?: unknown } | undefined)?.file);
          if (typeof path !== 'string') return path;
          if (!existsSync(path))
            return fail(`${this.relative(path)} doesn't exist. Use list_emails.`);
          let json: unknown;
          try {
            json = JSON.parse(readFileSync(path, 'utf8'));
          } catch (error) {
            return fail(`${this.relative(path)} is not valid JSON: ${(error as Error).message}`);
          }
          const result = validateDocument(json);
          if (!result.ok) {
            return fail(
              `${this.relative(path)} is not a valid email document:\n${formatIssues(result.issues)}`,
            );
          }
          this.open(path, result.document);
          return ok(`Opened ${this.relative(path)}. Call get_document to see it.`);
        },
      },
      {
        name: 'render_email',
        description:
          'Renders the open email to HTML (and plain text) next to its JSON file, and reports problems.',
        inputSchema: {
          type: 'object',
          properties: {
            out: {
              type: 'string',
              description: 'HTML path in the folder (default: same name, .html).',
            },
          },
        },
        execute: (input) => {
          if (!this.document || !this.file) return fail('No email is open. Call open_email first.');
          const out = (input as { out?: unknown } | undefined)?.out;
          const path =
            out === undefined ? this.file.replace(/\.json$/i, '.html') : this.path(out, '.html');
          if (typeof path !== 'string') return path;
          const result = renderEmail(
            this.document,
            this.assetsUrl ? { assetsUrl: this.assetsUrl } : {},
          );
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, result.html);
          writeFileSync(path.replace(/\.html?$/i, '.txt'), result.text);
          const problems = [
            ...result.warnings.map((warning) => warning.message),
            ...lintDocument(this.document).map((warning) => warning.message),
          ];
          const kb = (new TextEncoder().encode(result.html).length / 1024).toFixed(1);
          return ok(
            `Wrote ${this.relative(path)} (${kb} KB) and its plain-text version.${
              problems.length ? `\nWarnings:\n${problems.map((p) => `- ${p}`).join('\n')}` : ''
            }`,
          );
        },
      },
    ];
  }
}

/** Serves MCP over stdin/stdout (newline-delimited JSON-RPC). Logs go to stderr. */
export function serveStdio(options: McpServerOptions = {}): void {
  const server = new EmailMcpServer(options);
  process.stderr.write(`email-builder MCP server ${version}, folder ${server.dir}\n`);
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
      if (!line) continue;
      let response: JsonRpcMessage | null;
      try {
        response = server.handle(JSON.parse(line) as JsonRpcMessage);
      } catch {
        response = {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' },
        } as JsonRpcMessage;
      }
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  });
}
