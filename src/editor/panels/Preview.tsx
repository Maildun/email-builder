import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { renderEmail } from '../../render/html';
import { useEditorOptions, useEditorState, useMessages, useVisibleDocument } from '../context';
import { Badge, Button, cn, Icon, Tabs, TabsList, TabsTrigger } from '../ui';

/** The real rendered email in an isolated iframe, so media queries apply. */
export function Preview() {
  const document = useVisibleDocument();
  const viewport = useEditorState((state) => state.viewport);
  const { customBlocks, messages } = useEditorOptions();
  const { html } = useMemo(() => renderEmail(document, { customBlocks }), [document, customBlocks]);
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    let observer: ResizeObserver | null = null;
    const measure = () => {
      const body = iframe.contentDocument?.body;
      if (body) setHeight(Math.max(400, body.scrollHeight));
    };
    // Re-measure when the content reflows, e.g. columns stacking on mobile.
    const onLoad = () => {
      measure();
      observer?.disconnect();
      const body = iframe.contentDocument?.body;
      // The observer must come from the iframe's own window to see its layout.
      const FrameResizeObserver = (iframe.contentWindow as (Window & typeof globalThis) | null)
        ?.ResizeObserver;
      if (body && FrameResizeObserver) {
        observer = new FrameResizeObserver(measure);
        observer.observe(body);
      }
    };
    iframe.addEventListener('load', onLoad);
    return () => {
      iframe.removeEventListener('load', onLoad);
      observer?.disconnect();
    };
  }, []);

  // Also measure once the width transition after a viewport switch has
  // settled, for browsers that throttle observers inside iframes.
  useEffect(() => {
    if (!viewport) return;
    const timer = setTimeout(() => {
      const body = frame.current?.contentDocument?.body;
      if (body) setHeight(Math.max(400, body.scrollHeight));
    }, 260);
    return () => clearTimeout(timer);
  }, [viewport]);

  return (
    <div
      data-slot="preview"
      className="min-h-0 flex-1 overflow-auto p-6 pb-[calc(24px+var(--meb-overlay-space,0px))]"
    >
      <div
        data-slot="preview-frame"
        data-viewport={viewport === 'mobile' ? 'mobile' : 'desktop'}
        className={cn(
          'mx-auto max-w-full overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-foreground/5 transition-[width] duration-200 ease-out',
          viewport === 'mobile' && 'w-[375px] rounded-[36px] border-[10px] border-neutral-900',
        )}
      >
        <iframe
          ref={frame}
          title={messages.preview.frameTitle}
          className="block w-full border-0"
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
  const strings = useMessages().code;
  return (
    <Button
      size="xs"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <Icon icon={copied ? Tick02Icon : Copy01Icon} data-icon="inline-start" />
      {copied ? strings.copied : strings.copy}
    </Button>
  );
}

/** HTML, plain-text and JSON output. */
export function CodeView() {
  const document = useVisibleDocument();
  const { customBlocks, messages } = useEditorOptions();
  const text = messages.code;
  const rendered = useMemo(() => renderEmail(document, { customBlocks }), [document, customBlocks]);
  const json = useMemo(() => JSON.stringify(document, null, 2), [document]);
  const outputs = { html: rendered.html, text: rendered.text, json };
  const [tab, setTab] = useState<keyof typeof outputs>('html');

  return (
    <div
      data-slot="code-view"
      className="flex min-h-0 flex-1 flex-col p-4 pb-[calc(16px+var(--meb-overlay-space,0px))]"
    >
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as keyof typeof outputs)}
        className="min-h-0 flex-1 gap-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <TabsList className="group-data-horizontal/tabs:h-8">
            <TabsTrigger value="html">{text.html}</TabsTrigger>
            <TabsTrigger value="text">{text.text}</TabsTrigger>
            <TabsTrigger value="json">{text.json}</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="font-normal text-muted-foreground tabular-nums">
              {text.size(Math.round(new Blob([outputs[tab]]).size / 1024))}
            </Badge>
            <CopyButton text={outputs[tab]} />
          </div>
        </div>
        {rendered.warnings.length > 0 ? (
          <div
            data-slot="code-warnings"
            className="rounded-md bg-editor-ai-soft px-2.5 py-2 text-xs text-editor-ai"
          >
            {rendered.warnings.map((warning) => warning.message).join(' ')}
          </div>
        ) : null}
        <pre className="m-0 min-h-0 flex-1 overflow-auto rounded-lg border bg-card p-3.5 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
          <code>{outputs[tab]}</code>
        </pre>
      </Tabs>
    </div>
  );
}
