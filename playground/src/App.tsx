import { type EmailDocument, TEMPLATES, type TemplateName } from '@maildun/email-builder';
import { runTool } from '@maildun/email-builder/agent';
import { fromEmailBuilderJs, isEmailBuilderJsDocument } from '@maildun/email-builder/compat';
import {
  type AgentRequest,
  type EditorAgent,
  EmailEditor,
  type EmailEditorHandle,
} from '@maildun/email-builder/editor';
import { useMemo, useRef, useState } from 'react';
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

/** "Add a hero for our spring sale" → "Our spring sale". */
function headlineFrom(prompt: string): string {
  const topic = prompt
    .replace(
      /^(please\s+)?(add|write|create|make)\s+(a|an|the)?\s*(hero|section|banner)?\s*(for|about)?\s*/i,
      '',
    )
    .trim();
  return topic ? `${topic[0]?.toUpperCase()}${topic.slice(1, 60)}` : 'Spring sale';
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Scripted agent that drives the real tools, for trying the flow without an API key. */
const demoAgent: EditorAgent = {
  placeholder: 'Try: "add a footer", "make it purple", "add a features row"…',
  suggestions: ['Add a hero for our spring sale', 'Make the brand color purple', 'Add a footer'],
  async onRequest(request: AgentRequest) {
    const prompt = request.prompt.toLowerCase();
    const call = async (name: string, input: unknown, status: string) => {
      request.setStatus(status);
      await wait(350);
      if (request.signal.aborted) throw new Error('Stopped.');
      const result = runTool(request.tools, name, input);
      if (!result.ok) throw new Error(result.content);
      return result;
    };

    if (/purple|violet|color|colour|brand/.test(prompt)) {
      await call(
        'update_theme',
        { colors: { primary: '#7c3aed', link: '#7c3aed' } },
        'Updating the theme…',
      );
      return { summary: 'Switched the brand and link colors to purple.' };
    }
    if (/footer|unsubscribe/.test(prompt)) {
      await call(
        'insert_section',
        { name: 'footer', params: { company: 'Acme Inc.' } },
        'Adding a footer…',
      );
      return { summary: 'Added a footer with an unsubscribe link.' };
    }
    if (/feature|columns/.test(prompt)) {
      await call('insert_section', { name: 'features' }, 'Adding a features row…');
      return { summary: 'Added three feature columns that stack on mobile.' };
    }
    await call(
      'insert_section',
      {
        name: 'hero',
        index: 0,
        params: {
          heading: headlineFrom(request.prompt),
          text: 'Fresh picks, limited time. Everything you love, up to **40% off**.',
          buttonText: 'Shop the sale',
          imageSrc: 'https://picsum.photos/seed/spring/1200/600',
          imageAlt: 'Spring flowers',
        },
      },
      'Writing a hero section…',
    );
    await call(
      'update_settings',
      { settings: { preheader: 'Up to 40% off, this week only.' } },
      'Setting the preheader…',
    );
    return { summary: 'Added a hero section at the top and set the inbox preheader.' };
  },
};

/** Calls the playground's server middleware, which runs Claude with the same tools. */
const claudeAgent: EditorAgent = {
  placeholder: 'Ask Claude to write, restyle or restructure this email…',
  suggestions: [
    'Write a welcome email for new subscribers of a coffee roaster',
    'Rewrite the copy to be shorter and punchier',
    'Fix the accessibility warnings',
  ],
  async onRequest(request: AgentRequest) {
    request.setStatus('Claude is working…');
    const response = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: request.signal,
      body: JSON.stringify({
        prompt: request.prompt,
        document: request.document,
        selectedId: request.selectedId,
        history: request.history,
        mergeTags: MERGE_TAGS.map((tag) => tag.key),
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status}).`);
    return payload;
  },
};

export function App() {
  const editor = useRef<EmailEditorHandle>(null);
  const [template, setTemplate] = useState<TemplateName>('newsletter');
  const [agentMode, setAgentMode] = useState<'demo' | 'claude'>('demo');
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [document, setDocument] = useState<EmailDocument>(() => TEMPLATES.newsletter.create());
  const [version, setVersion] = useState(0);
  const agent = useMemo(() => (agentMode === 'claude' ? claudeAgent : demoAgent), [agentMode]);

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
          Assistant
          <select
            value={agentMode}
            onChange={(event) => setAgentMode(event.target.value as 'demo' | 'claude')}
          >
            <option value="demo">Demo (scripted)</option>
            <option value="claude">Claude (needs API key)</option>
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
          agent={agent}
          onPickImage={async () => ({
            url: `https://picsum.photos/seed/${Math.random().toString(36).slice(2, 8)}/1200/600`,
            alt: 'Random photo',
          })}
        />
      </div>
    </div>
  );
}
