import { type EmailDocument, TEMPLATES, type TemplateName } from '@maildun/email-builder';
import { runTool } from '@maildun/email-builder/agent';
import { fromEmailBuilderJs, isEmailBuilderJsDocument } from '@maildun/email-builder/compat';
import { EmailEditor, type EmailEditorHandle } from '@maildun/email-builder/editor';
import { useRef, useState } from 'react';
import { CUSTOM_BLOCKS } from './blocks';

// Serve the social icons from this repo (vite's publicDir) until the package is
// on npm; published installs load them from jsDelivr by default.
const ASSETS_URL = window.location.origin;

const MERGE_TAGS = [
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'unsubscribe_url', label: 'Unsubscribe link' },
  { key: 'web_view_url', label: 'View in browser' },
];

/**
 * Changes an AI might propose, made through `editor.tools()`: the same tools
 * an LLM would call. Your app runs its own model and passes it these tools;
 * the editor shows the result for review.
 */
const DEMO_PROPOSALS: Array<{ summary: string; calls: Array<[string, unknown]> }> = [
  {
    summary: 'Added a hero for the spring sale and set the inbox preheader.',
    calls: [
      [
        'insert_section',
        {
          name: 'hero',
          index: 0,
          params: {
            heading: 'Our spring sale',
            text: 'Fresh picks, limited time. Everything you love, up to **40% off**.',
            buttonText: 'Shop the sale',
            imageSrc: 'https://picsum.photos/seed/spring/1200/600',
            imageAlt: 'Spring flowers',
          },
        },
      ],
      ['update_settings', { settings: { preheader: 'Up to 40% off, this week only.' } }],
    ],
  },
  {
    summary: 'Switched the brand and link colors to purple.',
    calls: [['update_theme', { colors: { primary: '#7c3aed', link: '#7c3aed' } }]],
  },
  {
    summary: 'Added a testimonial before the footer.',
    calls: [['insert_section', { name: 'testimonial' }]],
  },
];

export function App() {
  const editor = useRef<EmailEditorHandle>(null);
  const [template, setTemplate] = useState<TemplateName>('newsletter');
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [document, setDocument] = useState<EmailDocument>(() => TEMPLATES.newsletter.create());
  const [version, setVersion] = useState(0);
  const demo = useRef(0);

  const proposeDemo = () => {
    const handle = editor.current;
    const proposal = DEMO_PROPOSALS[demo.current % DEMO_PROPOSALS.length];
    if (!handle || !proposal) return;
    demo.current += 1;
    const tools = handle.tools();
    for (const [name, input] of proposal.calls) {
      const result = runTool(tools, name, input);
      if (!result.ok) return window.alert(result.content);
    }
    handle.setProposalSummary(proposal.summary);
  };

  const load = (next: EmailDocument) => {
    setDocument(next);
    setVersion((value) => value + 1);
  };

  const importJson = async () => {
    const text = window.prompt(
      'Paste an @maildun/email-builder or EmailBuilder.js document (JSON):',
    );
    if (!text) return;
    try {
      const json = JSON.parse(text);
      load(isEmailBuilderJsDocument(json) ? fromEmailBuilderJs(json).document : json);
    } catch (error) {
      window.alert(`Could not import: ${(error as Error).message}`);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <strong>@maildun/email-builder</strong>
        <span className="spacer" />
        <label>
          Template
          <select
            value={template}
            onChange={(event) => {
              const name = event.target.value as TemplateName;
              setTemplate(name);
              load(TEMPLATES[name].create());
            }}
          >
            {Object.entries(TEMPLATES).map(([name, definition]) => (
              <option key={name} value={name}>
                {definition.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Theme
          <select
            value={theme}
            onChange={(event) => setTheme(event.target.value as 'system' | 'light' | 'dark')}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <button type="button" onClick={proposeDemo} title="Proposes changes through editor.tools()">
          Propose a change
        </button>
        <button type="button" onClick={importJson}>
          Import JSON
        </button>
        <button
          type="button"
          onClick={() => {
            const html = editor.current?.render().html ?? '';
            const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
            window.open(url, '_blank');
          }}
        >
          Open HTML
        </button>
      </header>
      <div className="app-editor">
        <EmailEditor
          key={version}
          ref={editor}
          value={document}
          onChange={setDocument}
          mergeTags={MERGE_TAGS}
          customBlocks={CUSTOM_BLOCKS}
          assetsUrl={ASSETS_URL}
          appearance={theme}
          onPickImage={async () => ({
            url: `https://picsum.photos/seed/${Math.random().toString(36).slice(2, 8)}/1200/600`,
            alt: 'Random photo',
          })}
        />
      </div>
    </div>
  );
}
