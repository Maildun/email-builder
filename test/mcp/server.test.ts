import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EmailMcpServer } from '../../src/mcp/server';

let dir: string;
let server: EmailMcpServer;
let nextId = 1;

function call(name: string, args: Record<string, unknown> = {}) {
  const response = server.handle({
    jsonrpc: '2.0',
    id: nextId++,
    method: 'tools/call',
    params: { name, arguments: args },
  }) as { result: { content: Array<{ text: string }>; isError: boolean } };
  return { text: response.result.content[0]?.text ?? '', isError: response.result.isError };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'email-mcp-'));
  server = new EmailMcpServer({ dir });
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('EmailMcpServer', () => {
  it('negotiates the protocol and teaches the client how to design emails', () => {
    const response = server.handle({
      jsonrpc: '2.0',
      id: 0,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test' } },
    }) as { result: { protocolVersion: string; instructions: string; capabilities: unknown } };
    expect(response.result.protocolVersion).toBe('2025-03-26');
    expect(response.result.capabilities).toEqual({ tools: {} });
    expect(response.result.instructions).toContain('## Blocks');
    expect(response.result.instructions).toContain('open_email');
    expect(server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
  });

  it('lists file tools and editing tools', () => {
    const response = server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) as {
      result: { tools: Array<{ name: string; inputSchema: unknown }> };
    };
    const names = response.result.tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining(['list_emails', 'create_email', 'open_email', 'render_email']),
    );
    expect(names).toEqual(
      expect.arrayContaining(['insert_section', 'update_block', 'check_email']),
    );
  });

  it('creates, edits (saving each change) and renders an email file', () => {
    expect(call('insert_section', { name: 'hero' }).isError).toBe(true);
    expect(call('create_email', { file: 'spring', template: 'newsletter' }).text).toContain(
      'spring.json',
    );
    expect(call('insert_section', { name: 'promo', index: 0 }).isError).toBe(false);
    const saved = JSON.parse(readFileSync(join(dir, 'spring.json'), 'utf8'));
    expect(JSON.stringify(saved)).toContain('SAVE20');

    const rendered = call('render_email');
    expect(rendered.text).toContain('spring.html');
    expect(readFileSync(join(dir, 'spring.html'), 'utf8')).toContain('<!DOCTYPE html>');
    expect(existsSync(join(dir, 'spring.txt'))).toBe(true);

    expect(call('list_emails').text).toContain('- spring.json');
    // A fresh server opens what the last one saved.
    server = new EmailMcpServer({ dir });
    expect(call('open_email', { file: 'spring.json' }).isError).toBe(false);
    expect(call('get_document').text).toContain('SAVE20');
  });

  it('stays inside its folder', () => {
    expect(call('create_email', { file: '../escape.json' }).text).toContain('outside');
    expect(call('open_email', { file: '/etc/passwd' }).isError).toBe(true);
  });

  it('answers unknown methods with a JSON-RPC error', () => {
    expect(server.handle({ jsonrpc: '2.0', id: 9, method: 'resources/list' })).toMatchObject({
      error: { code: -32601 },
    });
  });
});

describe('email-builder mcp', () => {
  it('speaks newline-delimited JSON-RPC over stdio', async () => {
    const child = spawn('bun', ['src/render/cli.ts', 'mcp', '--dir', dir]);
    const lines: string[] = [];
    let buffer = '';
    const received = new Promise<void>((resolve) => {
      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';
        lines.push(...parts.filter(Boolean));
        if (lines.length >= 2) resolve();
      });
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })}\n`,
    );
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
    );
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
    await received;
    child.kill();
    const [init, list] = lines.map((line) => JSON.parse(line));
    expect(init.result.serverInfo.name).toBe('email-builder');
    expect(list.id).toBe(2);
    expect(list.result.tools.length).toBeGreaterThan(10);
  });
});
