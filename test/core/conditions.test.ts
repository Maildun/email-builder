import { describe, expect, it } from 'vitest';
import {
  createDocument,
  lintDocument,
  matchesVisibleIf,
  renderEmail,
  resolveConditions,
  type VisibleIf,
  validateDocument,
} from '../../src';
import { buildSystemPrompt } from '../../src/agent';

const vipOnly: VisibleIf = { conditions: [{ id: 'tag:vip', label: 'VIP' }] };

function personalized(visibleIf: VisibleIf, markdown = 'VIP perks') {
  return createDocument({
    blocks: [
      { type: 'text', props: { markdown: 'Hello everyone' } },
      {
        type: 'container',
        id: 'vip-perks',
        props: { visibleIf },
        children: [{ type: 'text', props: { markdown } }],
      },
    ],
  });
}

const markers = { personalization: 'markers' } as const;

describe('matchesVisibleIf', () => {
  const conditions: VisibleIf['conditions'] = [
    { id: 'segment:pro' },
    { id: 'tag:churned', not: true },
  ];

  it('requires every condition by default and one with match any', () => {
    expect(matchesVisibleIf({ conditions }, new Set(['segment:pro']))).toBe(true);
    expect(matchesVisibleIf({ conditions }, new Set(['segment:pro', 'tag:churned']))).toBe(false);
    expect(matchesVisibleIf({ match: 'any', conditions }, new Set(['tag:churned']))).toBe(false);
    expect(matchesVisibleIf({ match: 'any', conditions }, new Set())).toBe(true);
    expect(matchesVisibleIf({ conditions: [] }, new Set())).toBe(true);
  });
});

describe('personalized sections', () => {
  it('validates conditions on containers and rejects bad ids', () => {
    expect(validateDocument(personalized(vipOnly)).ok).toBe(true);
    expect(() => personalized({ conditions: [{ id: '{{ vip }}' }] })).toThrow(/condition id/);
  });

  it('leaves personalized sections out unless the host asks for markers', () => {
    const { html, text } = renderEmail(personalized(vipOnly));
    expect(html).not.toContain('VIP perks');
    expect(html).not.toContain('meb:');
    expect(text).toBe('Hello everyone');
  });

  it('wraps sections in markers that resolve per reader, in HTML and text', () => {
    const { html, text } = renderEmail(personalized(vipOnly), markers);
    expect(html).toContain('<!--meb:if:vip.perks {"conditions":[');
    expect(html).toContain('<!--meb:endif:vip.perks-->');

    expect(resolveConditions(html, ['tag:vip'])).toContain('VIP perks');
    expect(resolveConditions(html, [])).not.toContain('VIP perks');
    expect(resolveConditions(html, [])).toContain('Hello everyone');
    expect(resolveConditions(text, []).trim()).toBe('Hello everyone');
    expect(resolveConditions(text, ['tag:vip'])).toContain('VIP perks');
  });

  it('never lets a stored label close the comment', () => {
    const { html } = renderEmail(
      personalized({ conditions: [{ id: 'tag:vip', label: 'a-->b' }] }),
      markers,
    );
    expect(html.match(/<!--meb:if:.*?-->/)?.[0]).toContain('a\\u002d\\u002d>b');
    expect(resolveConditions(html, ['tag:vip'])).toContain('VIP perks');
  });

  it('resolves nested sections and drops unreadable markers', () => {
    const document = createDocument({
      blocks: [
        {
          type: 'container',
          id: 'outer',
          props: { visibleIf: { conditions: [{ id: 'segment:customers' }] } },
          children: [
            { type: 'text', props: { markdown: 'Customers' } },
            {
              type: 'container',
              id: 'inner',
              props: { visibleIf: vipOnly },
              children: [{ type: 'text', props: { markdown: 'VIP only' } }],
            },
          ],
        },
      ],
    });
    const { html } = renderEmail(document, markers);
    const customer = resolveConditions(html, ['segment:customers']);
    expect(customer).toContain('Customers');
    expect(customer).not.toContain('VIP only');
    expect(customer).not.toContain('meb:');
    expect(resolveConditions(html, ['tag:vip'])).not.toContain('VIP only');
    expect(resolveConditions('<!--meb:if:b_1 {nope}-->Secret<!--meb:endif:b_1-->', [])).toBe('');
  });

  it('renders containers without conditions for everyone, and lint flags them', () => {
    const document = personalized({ conditions: [] });
    expect(renderEmail(document).html).toContain('VIP perks');
    expect(lintDocument(document).map((warning) => warning.code)).toContain('incomplete-condition');
    expect(lintDocument(personalized(vipOnly)).map((warning) => warning.code)).not.toContain(
      'incomplete-condition',
    );
  });

  it('tells the agent which groups it may target', () => {
    expect(buildSystemPrompt({ conditions: [{ id: 'tag:vip', label: 'VIP' }] })).toContain(
      '"tag:vip" (VIP)',
    );
    expect(buildSystemPrompt()).toContain('Do not set props.visibleIf');
  });
});
