#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CustomBlocks } from '../core/custom';
import { lintDocument } from '../core/lint';
import { validateDocument } from '../core/validate';
import { type McpServerOptions, serveStdio } from '../mcp/server';
import { renderEmail } from './html';

const USAGE = `Usage: email-builder <command> [file]

Reads a document as JSON from [file] or stdin and prints JSON to stdout.

Commands:
  render     {"html", "text", "warnings"}   (exit 1 if the document is invalid)
  validate   {"ok", "issues", "warnings"}
  mcp        Runs an MCP server (stdio) for AI clients to design emails in a folder.
             Options:
               --dir <folder>          where the email files live (default: current folder)
               --assets-url <url>      where rendered social icons load from
               --brief <text>          brand, audience or tone guidance for the AI
               --merge-tags <a,b,…>    merge tags your sending platform supports
               --blocks <module>       JS module exporting custom blocks (default export or "customBlocks")
               --require-unsubscribe   warn when the email has no {{ unsubscribe_url }}
`;

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

async function loadCustomBlocks(path: string): Promise<CustomBlocks> {
  const module = (await import(pathToFileURL(resolve(path)).href)) as {
    default?: unknown;
    customBlocks?: unknown;
  };
  const blocks = module.customBlocks ?? module.default;
  if (!Array.isArray(blocks)) {
    throw new Error(`${path} must export an array of custom blocks (default or "customBlocks").`);
  }
  return blocks as CustomBlocks;
}

async function serveMcp(argv: string[]): Promise<void> {
  const dir = option(argv, '--dir');
  const assetsUrl = option(argv, '--assets-url');
  const brief = option(argv, '--brief');
  const mergeTags = option(argv, '--merge-tags')
    ?.split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const blocks = option(argv, '--blocks');
  const options: McpServerOptions = {
    ...(dir ? { dir } : {}),
    ...(assetsUrl ? { assetsUrl } : {}),
    ...(brief ? { brief } : {}),
    ...(mergeTags?.length ? { mergeTags } : {}),
    ...(blocks ? { customBlocks: await loadCustomBlocks(blocks) } : {}),
    ...(argv.includes('--require-unsubscribe') ? { lint: { requireUnsubscribe: true } } : {}),
  };
  serveStdio(options);
}

function readInput(file: string | undefined): string {
  return readFileSync(file ?? 0, 'utf8');
}

function main(argv: string[]): number | undefined {
  const [command, file] = argv;
  if (command === 'mcp') {
    serveMcp(argv).catch((error: Error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 2;
    });
    return undefined;
  }
  if (command !== 'render' && command !== 'validate') {
    process.stderr.write(USAGE);
    return command === undefined || command === '--help' ? 0 : 2;
  }

  let input: unknown;
  try {
    input = JSON.parse(readInput(file));
  } catch (error) {
    process.stderr.write(`Could not read JSON: ${(error as Error).message}\n`);
    return 2;
  }

  const validation = validateDocument(input);
  if (command === 'validate') {
    process.stdout.write(
      JSON.stringify({
        ok: validation.ok,
        issues: validation.issues,
        warnings: validation.ok ? lintDocument(validation.document) : [],
      }),
    );
    return validation.ok ? 0 : 1;
  }

  if (!validation.ok) {
    process.stdout.write(JSON.stringify({ ok: false, issues: validation.issues }));
    return 1;
  }
  process.stdout.write(JSON.stringify(renderEmail(validation.document)));
  return 0;
}

const code = main(process.argv.slice(2));
if (code !== undefined) process.exitCode = code;
