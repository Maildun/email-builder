import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineBlock } from '../../src';
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

  it('annotates tools and offers every tool the library supports', () => {
    const response = server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) as {
      result: {
        tools: Array<{ name: string; title?: string; annotations?: Record<string, boolean> }>;
      };
    };
    const tools = Object.fromEntries(response.result.tools.map((tool) => [tool.name, tool]));
    for (const name of ['import_email', 'copy_email', 'undo', 'redo', 'get_reference']) {
      expect(tools[name], name).toBeDefined();
    }
    for (const tool of response.result.tools) expect(tool.title, tool.name).toBeTruthy();
    expect(tools.list_emails?.annotations?.readOnlyHint).toBe(true);
    expect(tools.remove_block?.annotations?.destructiveHint).toBe(true);
  });

  it('looks up the reference without an open email', () => {
    const result = call('get_reference', { topic: 'hero' });
    expect(result.isError).toBe(false);
    expect(result.text).toContain('### hero');
  });

  it('undoes and redoes changes, saving each step', () => {
    call('create_email', { file: 'steps' });
    call('insert_section', { name: 'hero' });
    call('insert_section', { name: 'footer' });
    const saved = () => readFileSync(join(dir, 'steps.json'), 'utf8');
    expect(saved()).toContain('Unsubscribe');
    expect(call('undo').text).toContain('1 more to undo');
    expect(saved()).not.toContain('Unsubscribe');
    call('undo');
    expect(JSON.parse(saved()).root).toEqual([]);
    expect(call('undo').isError).toBe(true);
    call('redo');
    call('redo');
    expect(call('redo').text).toBe('Nothing to redo.');
    expect(saved()).toContain('Unsubscribe');
    call('undo');
    call('insert_section', { name: 'cta' });
    expect(call('redo').isError).toBe(true); // A new change clears redo.
  });

  it('copies an email and opens the copy', () => {
    call('create_email', { file: 'base', template: 'newsletter' });
    expect(call('copy_email', { to: 'base' }).text).toContain('already exists');
    expect(call('copy_email', { to: 'variant' }).isError).toBe(false);
    call('update_settings', { settings: { preheader: 'Variant B' } });
    expect(readFileSync(join(dir, 'variant.json'), 'utf8')).toContain('Variant B');
    expect(readFileSync(join(dir, 'base.json'), 'utf8')).not.toContain('Variant B');
    expect(call('copy_email', { from: 'base.json', to: 'c' }).isError).toBe(false);
    expect(call('list_emails').text).toContain('- c.json (open)');
  });

  it('imports EmailBuilder.js documents', () => {
    copyFileSync(
      join(__dirname, '../fixtures/emailbuilderjs/one-time-passcode.json'),
      join(dir, 'otp.json'),
    );
    expect(call('open_email', { file: 'otp' }).text).toContain('import_email');
    const imported = call('import_email', { from: 'otp.json' });
    expect(imported.isError, imported.text).toBe(false);
    expect(imported.text).toContain('otp-imported.json');
    expect(call('get_document').text).toContain('heading');
    expect(call('import_email', { from: 'otp-imported.json', to: 'again' }).text).toContain(
      'not an EmailBuilder.js document',
    );
  });

  it('returns HTML inline on request', () => {
    call('create_email', { file: 'inline', template: 'newsletter' });
    expect(call('render_email').text).not.toContain('<!DOCTYPE html>');
    expect(call('render_email', { include_html: true }).text).toContain('<!DOCTYPE html>');
  });

  it('passes brief, merge tags, custom blocks and lint options through', () => {
    const product = defineBlock({
      name: 'product-card',
      label: 'Product card',
      description: 'A product with price.',
      schema: z.object({ title: z.string(), price: z.string() }),
      defaults: { title: 'Mug', price: '$12' },
      render: (data) => `<p>${data.title} ${data.price}</p>`,
    });
    server = new EmailMcpServer({
      dir,
      brief: 'Acme sells mugs.',
      mergeTags: ['first_name'],
      customBlocks: [product],
      lint: { requireUnsubscribe: true },
    });
    const instructions = server.instructions();
    expect(instructions).toContain('Acme sells mugs.');
    expect(instructions).toContain('{{ first_name }}');
    expect(instructions).toContain('### product-card');
    call('create_email', { file: 'mugs' });
    const inserted = call('insert_blocks', {
      blocks: [
        { type: 'custom', props: { name: 'product-card', data: { title: 'Cup', price: '$9' } } },
      ],
    });
    expect(inserted.isError, inserted.text).toBe(false);
    expect(call('check_email').text).toContain('missing-unsubscribe');
    call('render_email');
    expect(readFileSync(join(dir, 'mugs.html'), 'utf8')).toContain('Cup $9');
    expect(call('get_reference', { topic: 'product-card' }).text).toContain(
      'A product with price.',
    );
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
