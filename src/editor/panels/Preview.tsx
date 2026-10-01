import { Tabs } from '@base-ui/react/tabs';
import { Check, Copy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { renderEmail } from '../../render/html';
import { useEditorState, useVisibleDocument } from '../context';
import { Button, cx } from '../ui';

/** The real rendered email in an isolated iframe, so media queries apply. */
export function Preview() {
  const document = useVisibleDocument();
  const viewport = useEditorState((state) => state.viewport);
  const { html } = useMemo(() => renderEmail(document), [document]);
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    const measure = () => {
      const body = iframe.contentDocument?.documentElement;
      if (body) setHeight(Math.max(400, body.scrollHeight));
    };
    iframe.addEventListener('load', measure);
    return () => iframe.removeEventListener('load', measure);
  }, []);

  return (
    <div className="meb-preview-scroll">
      <div className={cx('meb-preview-frame', viewport === 'mobile' && 'meb-preview-mobile')}>
        <iframe
          ref={frame}
          title="Email preview"
          sandbox="allow-same-origin allow-popups"
          srcDoc={html}
          style={{ height }}
        />
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

/** HTML, plain-text and JSON output. */
export function CodeView() {
  const document = useVisibleDocument();
  const rendered = useMemo(() => renderEmail(document), [document]);
  const json = useMemo(() => JSON.stringify(document, null, 2), [document]);
  const outputs = { html: rendered.html, text: rendered.text, json };
  const [tab, setTab] = useState<keyof typeof outputs>('html');

  return (
    <div className="meb-code">
      <Tabs.Root value={tab} onValueChange={(value) => setTab(value as keyof typeof outputs)}>
        <div className="meb-row meb-between meb-code-bar">
          <Tabs.List className="meb-tabs meb-tabs-inline">
            <Tabs.Tab value="html" className="meb-tab">
              HTML
            </Tabs.Tab>
            <Tabs.Tab value="text" className="meb-tab">
              Plain text
            </Tabs.Tab>
            <Tabs.Tab value="json" className="meb-tab">
              JSON
            </Tabs.Tab>
          </Tabs.List>
          <div className="meb-row meb-gap-sm">
            <span className="meb-muted meb-small">
              {Math.round(new Blob([outputs[tab]]).size / 1024)} KB
            </span>
            <CopyButton text={outputs[tab]} />
          </div>
        </div>
        {rendered.warnings.length > 0 ? (
          <div className="meb-notice">
            {rendered.warnings.map((warning) => warning.message).join(' ')}
          </div>
        ) : null}
        <pre className="meb-pre">
          <code>{outputs[tab]}</code>
        </pre>
      </Tabs.Root>
    </div>
  );
}
