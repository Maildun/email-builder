import { describe, expect, it } from 'vitest';
import { applyOps, createDocument, renderEmail, validateDocument } from '../../src';
import {
  buildSystemPrompt,
  createAgentSession,
  isReadOnlyTool,
  outlineDocument,
  runTool,
  simplifySchema,
  toAnthropicTools,
  toMcpTools,
  toOpenAITools,
} from '../../src/agent';

describe('agent tools', () => {
  it('builds a newsletter from an empty document through tool calls', () => {
    const session = createAgentSession(createDocument(), { lint: { requireUnsubscribe: true } });
    const call = (name: string, input: unknown) => {
      const result = runTool(session.tools, name, input);
      expect(result.ok, result.content).toBe(true);
      return result;
    };

    call('update_theme', { colors: { primary: '#e11d48' }, fonts: { heading: 'BOOK_SERIF' } });
    call('update_settings', { settings: { preheader: 'Fresh picks for spring' } });
    call('insert_section', { name: 'header', params: { logoAlt: 'Bloom' } });
    call('insert_section', {
      name: 'hero',
      params: { heading: 'Spring is here', buttonText: 'Shop now' },
    });
    const inserted = call('insert_blocks', {
      blocks: [
        {
          id: 'picks',
          type: 'columns',
          children: [
            { type: 'text', props: { markdown: '**Tulips** from $9' } },
            { type: 'text', props: { markdown: '**Roses** from $12' } },
          ],
        },
      ],
    });
    expect(inserted.content).toContain('picks columns');
    call('update_block', { id: 'picks', props: { gap: 24 } });
    call('insert_section', { name: 'footer', params: { company: 'Bloom' } });

    const check = call('check_email', {});
    expect(check.content).not.toContain('missing-unsubscribe');
    expect(check.content).toContain('Plain text:');

    const document = session.getDocument();
    expect(validateDocument(document).ok).toBe(true);
    expect(document.theme.colors.primary).toBe('#e11d48');
    expect(renderEmail(document).html).toContain('#e11d48');
    expect(session.ops.length).toBe(7);
    expect(session.changed.has('picks')).toBe(true);
  });

  it('records ops that replay to the identical document', () => {
    const start = createDocument({ blocks: [{ id: 'intro', type: 'text' }] });
    const session = createAgentSession(start);
    runTool(session.tools, 'insert_section', { name: 'hero' });
    const inserted = runTool(session.tools, 'insert_blocks', { blocks: [{ type: 'button' }] });
    const newId = (inserted.data as { inserted: string[] }).inserted[0] as string;
    runTool(session.tools, 'update_block', { id: newId, props: { text: 'Go' } });
    runTool(session.tools, 'duplicate_block', { id: 'intro' });
    const replay = applyOps(start, session.ops);
    expect(replay.ok && replay.document).toEqual(session.getDocument());
  });

  it('explains rejected input and leaves the document untouched', () => {
    const session = createAgentSession(createDocument({ blocks: [{ id: 'cta', type: 'button' }] }));
    const before = session.getDocument();
    const result = runTool(session.tools, 'update_block', {
      id: 'cta',
      props: { url: 'https://x.test' },
    });
    expect(result.ok).toBe(false);
    expect(result.content).toContain('Did you mean "href"?');
    expect(session.getDocument()).toBe(before);

    const missing = runTool(session.tools, 'remove_block', { id: 'nope' });
    expect(missing.content).toContain('does not exist');

    const badInput = runTool(session.tools, 'move_block', { id: 'cta' });
    expect(badInput.ok).toBe(false);
    expect(runTool(session.tools, 'teleport', {}).content).toContain('Unknown tool');
  });

  it('applies batches atomically', () => {
    const session = createAgentSession(createDocument());
    const result = runTool(session.tools, 'apply_ops', {
      ops: [
        { op: 'insert', blocks: [{ id: 'one', type: 'text' }] },
        { op: 'update', id: 'one', props: { markdown: 123 } },
      ],
    });
    expect(result.ok).toBe(false);
    expect(session.getDocument().root).toEqual([]);
  });

  it('returns block JSON and an outline', () => {
    const session = createAgentSession(
      createDocument({ blocks: [{ id: 'title', type: 'heading', props: { text: 'Hi' } }] }),
    );
    expect(runTool(session.tools, 'get_document', {}).content).toContain(
      '- title heading: h2 "Hi"',
    );
    expect(JSON.parse(runTool(session.tools, 'get_block', { id: 'title' }).content)).toMatchObject({
      id: 'title',
      type: 'heading',
    });
    expect(outlineDocument(createDocument())).toContain('(empty)');
  });
});

describe('adapters and prompt', () => {
  const { tools } = createAgentSession(createDocument());

  it('produces provider tool shapes with object schemas', () => {
    for (const tool of toAnthropicTools(tools)) {
      expect(tool.input_schema.type).toBe('object');
    }
    expect(toOpenAITools(tools)[0]).toMatchObject({
      type: 'function',
      function: { name: 'get_document' },
    });
    expect(toMcpTools(tools)[0]).toHaveProperty('inputSchema');
  });

  it('keeps compact tool schemas small', () => {
    const size = JSON.stringify(toAnthropicTools(tools)).length;
    expect(size).toBeLessThan(12_000);
  });

  it('documents every block type and section in the system prompt', () => {
    const prompt = buildSystemPrompt({ mergeTags: ['first_name', 'unsubscribe_url'] });
    for (const type of [
      'heading',
      'text',
      'button',
      'social',
      'image',
      'video',
      'avatar',
      'divider',
      'spacer',
      'html',
      'container',
      'columns',
      'column',
    ]) {
      expect(prompt).toContain(`### ${type}`);
    }
    expect(prompt).toContain('href:');
    expect(prompt).toContain('{{ first_name }}');
    expect(prompt).toContain('- footer:');
    expect(prompt).toContain('- testimonial:');
  });

  it('annotates tools and passes titles and annotations to MCP', () => {
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    for (const name of ['get_document', 'get_block', 'get_reference', 'check_email']) {
      expect(isReadOnlyTool(byName[name])).toBe(true);
    }
    expect(isReadOnlyTool(byName.update_block)).toBe(false);
    expect(byName.remove_block?.annotations?.destructiveHint).toBe(true);
    expect(byName.insert_section?.annotations?.destructiveHint).toBe(false);
    const mcp = toMcpTools(tools).find((tool) => tool.name === 'insert_section');
    expect(mcp).toMatchObject({ title: 'Insert section', annotations: { readOnlyHint: false } });
  });

  it('simplifies schemas for strict OpenAI-compatible APIs', () => {
    const strict = createAgentSession(createDocument(), { strictSchemas: true }).tools;
    const simple = JSON.stringify(toOpenAITools(strict, { simpleSchemas: true }));
    expect(simple).not.toMatch(/"\$ref"|"\$defs"|"\$schema"|additionalProperties|propertyNames/);
    expect(simplifySchema({ type: 'integer', maximum: 2 ** 53 })).toEqual({ type: 'integer' });
    expect(JSON.stringify(toOpenAITools(strict))).toContain('$ref');
  });
});

describe('get_reference', () => {
  const { tools } = createAgentSession(createDocument());
  const look = (topic: string) => runTool(tools, 'get_reference', { topic });

  it('describes a block type with typed props, style, defaults and placement', () => {
    const button = look('button');
    expect(button.ok).toBe(true);
    expect(button.content).toContain('### button');
    expect(button.content).toContain('href:');
    expect(button.content).toContain('defaults:');
    expect(button.content).toContain('goes in: root, container, column');
    expect(look('columns').content).toContain('holds: column');
  });

  it('covers sections, templates and catalogs', () => {
    expect(look('navheader').content).toContain('### navHeader');
    expect(look('templates').content).toContain('- newsletter:');
    expect(look('sections').content).toContain('- footer:');
    expect(look('blocks').content).toContain('### image');
    expect(look('custom-blocks').content).toContain('No custom blocks');
  });

  it('explains unknown topics', () => {
    const result = look('carousel');
    expect(result.ok).toBe(false);
    expect(result.content).toContain('a block type');
  });
});
