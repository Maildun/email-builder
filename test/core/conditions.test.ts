import { describe, expect, it } from 'vitest';
import {
  createDocument,
  lintDocument,
  matchesRule,
  matchesVisibleIf,
  renderEmail,
  resolveConditions,
  type VisibleIf,
  validateDocument,
} from '../../src';

const proOnly: VisibleIf = { rules: [{ field: 'plan', operator: 'equals', value: 'Pro' }] };

function personalized(visibleIf: VisibleIf, markdown = 'Pro perks') {
  return createDocument({
    blocks: [
      { type: 'text', props: { markdown: 'Hello everyone' } },
      {
        type: 'container',
        id: 'pro-perks',
        props: { visibleIf },
        children: [{ type: 'text', props: { markdown } }],
      },
    ],
  });
}

describe('matchesRule', () => {
  it('treats missing, empty and blank values as not set', () => {
    for (const data of [{}, { plan: '' }, { plan: '  ' }, { plan: null }]) {
      expect(matchesRule({ field: 'plan', operator: 'is_set' }, data)).toBe(false);
      expect(matchesRule({ field: 'plan', operator: 'is_not_set' }, data)).toBe(true);
    }
    expect(matchesRule({ field: 'plan', operator: 'is_set' }, { plan: 0 })).toBe(true);
  });

  it('compares text ignoring case and surrounding spaces', () => {
    const data = { plan: ' Pro Annual ' };
    expect(matchesRule({ field: 'plan', operator: 'equals', value: 'pro annual' }, data)).toBe(
      true,
    );
    expect(matchesRule({ field: 'plan', operator: 'not_equals', value: 'pro' }, data)).toBe(true);
    expect(matchesRule({ field: 'plan', operator: 'contains', value: 'ANNUAL' }, data)).toBe(true);
    expect(matchesRule({ field: 'plan', operator: 'not_contains', value: 'pro' }, data)).toBe(
      false,
    );
  });
});

describe('matchesVisibleIf', () => {
  const rules: VisibleIf['rules'] = [
    { field: 'plan', operator: 'equals', value: 'pro' },
    { field: 'country', operator: 'equals', value: 'ID' },
  ];

  it('requires every rule by default and one rule with match any', () => {
    expect(matchesVisibleIf({ rules }, { plan: 'pro', country: 'SG' })).toBe(false);
    expect(matchesVisibleIf({ match: 'any', rules }, { plan: 'pro', country: 'SG' })).toBe(true);
    expect(matchesVisibleIf({ rules: [] }, {})).toBe(true);
  });
});

describe('personalized sections', () => {
  it('validates rules on containers and rejects bad field keys', () => {
    expect(validateDocument(personalized(proOnly)).ok).toBe(true);
    expect(() => personalized({ rules: [{ field: '{{ plan }}', operator: 'is_set' }] })).toThrow(
      /merge tag key/,
    );
  });

  it('wraps the section in markers that resolve per reader, in HTML and text', () => {
    const { html, text } = renderEmail(personalized(proOnly));
    expect(html).toContain('<!--meb:if:pro.perks {"rules":[');
    expect(html).toContain('<!--meb:endif:pro.perks-->');

    expect(resolveConditions(html, { plan: 'pro' })).toContain('Pro perks');
    expect(resolveConditions(html, { plan: 'free' })).not.toContain('Pro perks');
    expect(resolveConditions(html, { plan: 'free' })).toContain('Hello everyone');
    expect(resolveConditions(text, { plan: 'free' }).trim()).toBe('Hello everyone');
    expect(resolveConditions(text, { plan: 'pro' })).toContain('Pro perks');
  });

  it('never lets rule values close the comment', () => {
    const { html } = renderEmail(
      personalized({ rules: [{ field: 'code', operator: 'equals', value: 'a-->b' }] }),
    );
    const marker = html.match(/<!--meb:if:.*?-->/)?.[0] ?? '';
    expect(marker).toContain('a\\u002d\\u002d>b');
    expect(resolveConditions(html, { code: 'a-->b' })).toContain('Pro perks');
    expect(resolveConditions(html, { code: 'x' })).not.toContain('Pro perks');
  });

  it('resolves nested sections', () => {
    const document = createDocument({
      blocks: [
        {
          type: 'container',
          id: 'outer',
          props: { visibleIf: { rules: [{ field: 'plan', operator: 'is_set' }] } },
          children: [
            { type: 'text', props: { markdown: 'Any plan' } },
            {
              type: 'container',
              id: 'inner',
              props: { visibleIf: proOnly },
              children: [{ type: 'text', props: { markdown: 'Pro only' } }],
            },
          ],
        },
      ],
    });
    const { html } = renderEmail(document);
    const free = resolveConditions(html, { plan: 'free' });
    expect(free).toContain('Any plan');
    expect(free).not.toContain('Pro only');
    expect(free).not.toContain('meb:');
    expect(resolveConditions(html, {})).not.toContain('Any plan');
  });

  it('renders plain containers without markers', () => {
    const { html } = renderEmail(personalized({ rules: [] }));
    expect(html).not.toContain('meb:if');
  });

  it('warns about rules that need a value', () => {
    const warnings = lintDocument(
      personalized({ rules: [{ field: 'plan', operator: 'equals', value: ' ' }] }),
    );
    expect(warnings.map((warning) => warning.code)).toContain('incomplete-condition');
    expect(lintDocument(personalized(proOnly)).map((warning) => warning.code)).not.toContain(
      'incomplete-condition',
    );
  });
});
