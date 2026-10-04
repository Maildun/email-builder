import {
  Copy01Icon,
  TextAlignLeftIcon,
  TextWrapIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createRenderContext } from '../../render/context';
import { renderEmail } from '../../render/html';
import { EmailFrame, emailWidth } from '../canvas/EmailFrame';
import { useEditorOptions, useEditorState, useMessages, useVisibleDocument } from '../context';
import { Badge, Button, Icon, Tabs, TabsList, TabsTrigger, Tip } from '../ui';
import { CodeBlock } from './CodeBlock';
import { formatHtml, tokenizeHtml, tokenizeJson, tokenizeText, toLines } from './code';

/** The real rendered email in an isolated iframe, so media queries apply. */
export function Preview() {
  const document = useVisibleDocument();
  const viewport = useEditorState((state) => state.viewport);
  const { customBlocks, assetsUrl, messages } = useEditorOptions();
  const { html } = useMemo(
    () => renderEmail(document, { customBlocks, assetsUrl }),
    [document, customBlocks, assetsUrl],
  );
  const backdrop = useMemo(
    () =>
      createRenderContext(document, { customBlocks }).color(
        document.settings.backdropColor,
        '$background',
      ),
    [document, customBlocks],
  );
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    let observer: ResizeObserver | null = null;
    const measure = () => {
      const body = iframe.contentDocument?.body;
      if (body) setHeight(body.scrollHeight);
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
      if (body) setHeight(body.scrollHeight);
    }, 260);
    return () => clearTimeout(timer);
  }, [viewport]);

  return (
    <div
      data-slot="preview"
      className="min-h-0 flex-1 overflow-auto p-6 pb-[calc(24px+var(--meb-overlay-space,0px))]"
    >
      {/*
        The same frame as the design canvas. On desktop the iframe spans the gutters too: the
        email draws its own backdrop around the centered content, and its viewport must be wider
        than the mobile breakpoint (settings.width + 20px) or the columns would stack. On mobile
        the viewport is the phone's width, so the mobile styles apply.
      */}
      <EmailFrame
        data-slot="preview-frame"
        data-viewport={viewport}
        width={emailWidth(document, viewport)}
        backdrop={backdrop}
        style={viewport === 'mobile' ? undefined : { paddingInline: 0 }}
      >
        <iframe
          ref={frame}
          title={messages.preview.frameTitle}
          className="block w-full border-0"
          sandbox="allow-same-origin allow-popups"
          srcDoc={html}
          style={{ height }}
        />
      </EmailFrame>
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
  const { customBlocks, assetsUrl, messages } = useEditorOptions();
  const text = messages.code;
  const rendered = useMemo(
    () => renderEmail(document, { customBlocks, assetsUrl }),
    [document, customBlocks, assetsUrl],
  );
  const json = useMemo(() => JSON.stringify(document, null, 2), [document]);
  const outputs = { html: rendered.html, text: rendered.text, json };
  const [tab, setTab] = useState<keyof typeof outputs>('html');
  const [formatted, setFormatted] = useState(true);
  // Prose and unformatted HTML read better wrapped; indented code reads better unwrapped.
  const [wrap, setWrap] = useState({ html: false, text: true, json: false });
  const lines = useMemo(() => {
    if (tab === 'json') return toLines(tokenizeJson(json));
    if (tab === 'text') return toLines(tokenizeText(rendered.text));
    return toLines(tokenizeHtml(formatted ? formatHtml(rendered.html) : rendered.html));
  }, [tab, json, rendered, formatted]);

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
            {tab === 'html' ? (
              <Tip label={text.format}>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={text.format}
                  aria-pressed={formatted}
                  className="aria-pressed:bg-muted aria-pressed:text-foreground"
                  onClick={() => {
                    setFormatted(!formatted);
                    setWrap((current) => ({ ...current, html: formatted }));
                  }}
                >
                  <Icon icon={TextAlignLeftIcon} />
                </Button>
              </Tip>
            ) : null}
            <Tip label={text.wrap}>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={text.wrap}
                aria-pressed={wrap[tab]}
                className="aria-pressed:bg-muted aria-pressed:text-foreground"
                onClick={() => setWrap((current) => ({ ...current, [tab]: !current[tab] }))}
              >
                <Icon icon={TextWrapIcon} />
              </Button>
            </Tip>
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
        {/* Keyed by tab so each output opens at the top. */}
        <CodeBlock key={tab} lines={lines} wrap={wrap[tab]} label={text[tab]} />
      </Tabs>
    </div>
  );
}
