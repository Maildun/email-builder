import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { applyOps, createDocument, defineBlock, renderEmail } from '../../src';
import { buildSystemPrompt, createAgentSession, runTool } from '../../src/agent';

const productCard = defineBlock({
  name: 'product-card',
  label: 'Product',
  description: 'A product with a name and a price.',
  schema: z.object({ title: z.string().min(1), price: z.string() }),
  defaults: { title: 'Mug', price: '$12' },
  render: (data, ctx) =>
    `<p style="color:${ctx.color('$primary')}">${ctx.escape(data.title)} · ${ctx.escape(data.price)} · ${ctx.width}px</p>`,
  text: (data) => `${data.title}: ${data.price}`,
});

const doc = () =>
  createDocument({
    blocks: [
      {
        id: 'card',
        type: 'custom',
        props: { name: 'product-card', data: { title: 'Mug <b>', price: '$12' } },
      },
    ],
  });

describe('custom blocks', () => {
  it('rejects bad names and defaults that do not match the schema', () => {
    expect(() => defineBlock({ ...productCard, name: 'Product Card' })).toThrow(/Invalid custom/);
    expect(() => defineBlock({ ...productCard, defaults: { title: '', price: '$1' } })).toThrow(
      /don't match/,
    );
  });

  it('renders inside the standard block cell, escaped, with a plain-text version', () => {
    const { html, text, warnings } = renderEmail(doc(), { customBlocks: [productCard] });
    expect(html).toContain('Mug &lt;b&gt; · $12 · 552px');
    expect(text).toContain('Mug <b>: $12');
    expect(warnings).toEqual([]);
  });

  it('warns instead of failing when a definition is missing, data is invalid or render throws', () => {
    expect(renderEmail(doc()).warnings.map((w) => w.code)).toContain('unknown-custom-block');
    const broken = defineBlock({
      ...productCard,
      render: () => {
        throw new Error('boom');
      },
    });
    expect(renderEmail(doc(), { customBlocks: [broken] }).warnings[0]).toMatchObject({
      code: 'custom-block-error',
      blockId: 'card',
    });
  });

  it('validates data on edit when definitions are given', () => {
    const result = applyOps(
      doc(),
      { op: 'update', id: 'card', props: { data: { title: '' } } },
      { customBlocks: [productCard] },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.path).toBe('blocks.card.props.data.title');

    const unknown = applyOps(
      doc(),
      { op: 'insert', blocks: [{ type: 'custom', props: { name: 'coupon' } }] },
      { customBlocks: [productCard] },
    );
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.issues[0]?.hint).toContain('product-card');
  });

  it('documents custom blocks for agents and validates their tool calls', () => {
    const prompt = buildSystemPrompt({ customBlocks: [productCard] });
    expect(prompt).toContain('## Custom blocks');
    expect(prompt).toContain('### product-card');

    const session = createAgentSession(doc(), { customBlocks: [productCard] });
    const bad = runTool(session.tools, 'insert_blocks', {
      blocks: [{ type: 'custom', props: { name: 'product-card', data: { price: '$1' } } }],
    });
    expect(bad.ok).toBe(false);
    const good = runTool(session.tools, 'insert_blocks', {
      blocks: [{ type: 'custom', props: { name: 'product-card', data: productCard.defaults } }],
    });
    expect(good.ok).toBe(true);
  });
});
