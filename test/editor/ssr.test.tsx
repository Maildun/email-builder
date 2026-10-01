// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDocument } from '../../src';
import { EmailEditor } from '../../src/editor';

describe('<EmailEditor> on the server', () => {
  it('renders without a DOM, including raw HTML blocks', () => {
    const document = createDocument({
      blocks: [
        { id: 'title', type: 'heading', props: { text: 'Hello world' } },
        { id: 'raw', type: 'html', props: { html: '<p>Raw</p>' } },
      ],
    });
    const html = renderToString(<EmailEditor defaultValue={document} />);
    expect(html).toContain('Hello world');
    expect(html).toContain('data-block-id="raw"');
  });
});
