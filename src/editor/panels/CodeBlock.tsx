import { memo } from 'react';
import { useMessages } from '../context';
import { cn } from '../ui';
import type { Token } from './code';

function TokenView({ token }: { token: Token }) {
  const strings = useMessages().code;
  if (token.type === 'repeat') {
    return (
      <span data-token="repeat" title={strings.repeatedTip}>
        {token.unit}
        <span data-slot="code-repeat" className="ml-1 rounded-sm px-1 font-sans">
          {strings.repeated(token.count)}
        </span>
      </span>
    );
  }
  if (token.type === 'text') return token.text;
  return <span data-token={token.type}>{token.text}</span>;
}

/**
 * Read-only code with line numbers and syntax colors. Lines come pre-split
 * (see `toLines`); colors are `data-token` attributes styled in editor.css.
 */
export const CodeBlock = memo(function CodeBlock({
  lines,
  wrap,
  label,
}: {
  lines: Token[][];
  wrap: boolean;
  /** Accessible name, e.g. "HTML". */
  label: string;
}) {
  const digits = String(lines.length).length;
  return (
    <section
      data-slot="code-block"
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable regions must be reachable by keyboard.
      tabIndex={0}
      data-wrap={wrap || undefined}
      className="meb-code min-h-0 flex-1 overflow-auto rounded-lg border bg-card py-3 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className={cn('flex flex-col', !wrap && 'min-w-max')}>
        {lines.map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional.
          <div key={index} className="flex">
            <span
              aria-hidden
              data-slot="code-gutter"
              className="sticky left-0 shrink-0 bg-card pr-3 pl-3.5 text-right text-muted-foreground/60 tabular-nums select-none"
              style={{ minWidth: `calc(${digits}ch + 1.75rem)` }}
            >
              {index + 1}
            </span>
            <span
              className={cn(
                'min-w-0 flex-1 pr-4',
                wrap ? 'wrap-anywhere whitespace-pre-wrap' : 'whitespace-pre',
              )}
            >
              {line.length === 0 ? '\n' : null}
              {line.map((token, tokenIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional.
                <TokenView key={tokenIndex} token={token} />
              ))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
});
