import { Add01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { useId } from 'react';
import {
  SOCIAL_LABELS,
  SOCIAL_NETWORKS,
  SOCIAL_STARTER_URLS,
  type SocialNetwork,
  socialIconUrl,
} from '../../core/social';
import { useEditorOptions, useMessages } from '../context';
import { Button, cn, Icon, Popover, SelectInput, Tip } from '../ui';
import { ImageInput, UrlInput } from './controls';

interface SocialLink {
  network: SocialNetwork;
  href: string;
  label?: string;
  icon?: string;
}

type Commit = (value: unknown) => string | null;

function NetworkIcon({
  network,
  src,
  className,
}: {
  network: SocialNetwork;
  /** A custom icon to show instead of the built-in one. */
  src?: string | undefined;
  className?: string;
}) {
  const { assetsUrl } = useEditorOptions();
  return (
    <img
      src={src ?? socialIconUrl(assetsUrl, network, 'brand')}
      alt=""
      className={cn('size-4 shrink-0 rounded-full object-cover', className)}
      draggable={false}
    />
  );
}

/** The row's icon: opens a popover to use your own image instead of the built-in one. */
function IconPicker({
  link,
  inputId,
  onChange,
}: {
  link: SocialLink;
  inputId: string;
  onChange: (icon: string | undefined) => string | null;
}) {
  const text = useMessages().inspector;
  const name = SOCIAL_LABELS[link.network];
  return (
    <Popover
      align="start"
      trigger={
        <Button
          size="icon-sm"
          variant="outline"
          aria-label={text.socialIcon(name)}
          className="relative shrink-0"
        >
          <NetworkIcon network={link.network} src={link.icon} className="size-5" />
          {link.icon ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-editor-selection ring-2 ring-card"
            />
          ) : null}
        </Button>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="font-medium text-sm">
          {text.customIcon}
        </label>
        <ImageInput id={inputId} value={link.icon} onCommit={onChange} />
        <p className="text-muted-foreground text-xs">{text.customIconHint}</p>
      </div>
      {link.icon ? (
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => onChange(undefined)}
        >
          <NetworkIcon network={link.network} />
          {text.useBuiltInIcon}
        </Button>
      ) : null}
    </Popover>
  );
}

/** The social block's links: one row per icon, each with its network and URL. */
export function SocialLinksInput({ value, commit }: { value: unknown; commit: Commit }) {
  const links = (Array.isArray(value) ? value : []) as SocialLink[];
  const text = useMessages().inspector;
  const baseId = useId();
  const networkOptions = SOCIAL_NETWORKS.map((network) => ({
    value: network,
    label: (
      <span className="flex items-center gap-2">
        <NetworkIcon network={network} />
        {SOCIAL_LABELS[network]}
      </span>
    ),
  }));

  const replace = (index: number, link: SocialLink) =>
    commit(links.map((current, i) => (i === index ? link : current)));

  const add = () => {
    const used = new Set(links.map((link) => link.network));
    const network = SOCIAL_NETWORKS.find((candidate) => !used.has(candidate)) ?? 'website';
    commit([...links, { network, href: SOCIAL_STARTER_URLS[network] }]);
  };

  return (
    <div data-slot="social-links" className="flex flex-col gap-3">
      {links.map((link, index) => {
        const name = SOCIAL_LABELS[link.network];
        return (
          // Links have no ids; the index is their identity while editing.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <div key={index} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <IconPicker
                link={link}
                inputId={`${baseId}-${index}-icon`}
                onChange={(icon) => {
                  const { icon: _previous, ...rest } = link;
                  return replace(index, icon ? { ...rest, icon } : rest);
                }}
              />
              <div className="min-w-0 flex-1">
                <SelectInput<SocialNetwork>
                  value={link.network}
                  options={networkOptions}
                  placeholder={text.socialNetwork}
                  onChange={(network) => {
                    // Swap a starter link for the new network's; keep a real one.
                    const starter = link.href === SOCIAL_STARTER_URLS[link.network];
                    replace(index, {
                      ...link,
                      network,
                      href: starter ? SOCIAL_STARTER_URLS[network] : link.href,
                    });
                  }}
                />
              </div>
              <Tip label={text.removeSocialLink(name)}>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={text.removeSocialLink(name)}
                  onClick={() => commit(links.filter((_, i) => i !== index))}
                >
                  <Icon icon={Cancel01Icon} />
                </Button>
              </Tip>
            </div>
            <UrlInput
              id={`${baseId}-${index}`}
              value={link.href}
              placeholder={SOCIAL_STARTER_URLS[link.network]}
              onCommit={(href) => (href ? replace(index, { ...link, href }) : null)}
            />
          </div>
        );
      })}
      <Button size="sm" variant="outline" className="w-full" onClick={add}>
        <Icon icon={Add01Icon} data-icon="inline-start" />
        {text.addSocialLink}
      </Button>
    </div>
  );
}
