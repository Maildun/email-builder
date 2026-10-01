import { describe, expect, it } from 'vitest';
import { fromEditorMarkdown } from '../../src/editor/canvas/InlineText';

describe('fromEditorMarkdown', () => {
  it('unescapes characters the serializer escaped inside merge tags', () => {
    expect(fromEditorMarkdown('Hi {{ first\\_name }},')).toBe('Hi {{ first_name }},');
    expect(fromEditorMarkdown('\\{\\{ web\\_view\\_url \\}\\}')).toBe('{{ web_view_url }}');
    expect(fromEditorMarkdown('{{ user.first\\_name }} and {{ last\\_name }}')).toBe(
      '{{ user.first_name }} and {{ last_name }}',
    );
  });

  it('keeps escapes outside merge tags', () => {
    expect(fromEditorMarkdown('snake\\_case and {{ first\\_name }}')).toBe(
      'snake\\_case and {{ first_name }}',
    );
  });

  it('turns merge-tag links back into tags', () => {
    expect(fromEditorMarkdown('[Unsubscribe](https://meb-merge.invalid/unsubscribe_url)\n')).toBe(
      '[Unsubscribe]({{ unsubscribe_url }})',
    );
  });
});
