#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { lintDocument } from '../core/lint';
import { validateDocument } from '../core/validate';
import { renderEmail } from './html';

const USAGE = `Usage: email-builder <command> [file]

Reads a document as JSON from [file] or stdin and prints JSON to stdout.

Commands:
  render     {"html", "text", "warnings"}   (exit 1 if the document is invalid)
  validate   {"ok", "issues", "warnings"}
`;

function readInput(file: string | undefined): string {
  return readFileSync(file ?? 0, 'utf8');
}

function main(argv: string[]): number {
  const [command, file] = argv;
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

process.exitCode = main(process.argv.slice(2));
