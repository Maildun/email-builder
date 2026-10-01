import { version } from '../../package.json';

/** Networks the social block has icons for, in palette order. */
export const SOCIAL_NETWORKS = [
  'x',
  'facebook',
  'instagram',
  'linkedin',
  'youtube',
  'tiktok',
  'threads',
  'bluesky',
  'github',
  'discord',
  'whatsapp',
  'pinterest',
  'telegram',
  'mastodon',
  'reddit',
  'website',
  'email',
] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

/** Display names, also the icons' default alt text. */
export const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  x: 'X',
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  threads: 'Threads',
  bluesky: 'Bluesky',
  github: 'GitHub',
  discord: 'Discord',
  whatsapp: 'WhatsApp',
  pinterest: 'Pinterest',
  telegram: 'Telegram',
  mastodon: 'Mastodon',
  reddit: 'Reddit',
  website: 'Website',
  email: 'Email',
};

/** Starting link for a newly added icon; lint flags it until it points at a profile. */
export const SOCIAL_STARTER_URLS: Record<SocialNetwork, string> = {
  x: 'https://x.com',
  facebook: 'https://facebook.com',
  instagram: 'https://instagram.com',
  linkedin: 'https://linkedin.com',
  youtube: 'https://youtube.com',
  tiktok: 'https://tiktok.com',
  threads: 'https://threads.net',
  bluesky: 'https://bsky.app',
  github: 'https://github.com',
  discord: 'https://discord.com',
  whatsapp: 'https://wa.me',
  pinterest: 'https://pinterest.com',
  telegram: 'https://t.me',
  mastodon: 'https://mastodon.social',
  reddit: 'https://reddit.com',
  website: 'https://example.com',
  email: 'mailto:hello@example.com',
};

const NETWORK_HOSTS: Array<[RegExp, SocialNetwork]> = [
  [/(^|\.)(x|twitter)\.com$/, 'x'],
  [/(^|\.)(facebook\.com|fb\.com)$/, 'facebook'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)linkedin\.com$/, 'linkedin'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)threads\.(net|com)$/, 'threads'],
  [/(^|\.)bsky\.app$/, 'bluesky'],
  [/(^|\.)github\.com$/, 'github'],
  [/(^|\.)discord\.(gg|com)$/, 'discord'],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, 'whatsapp'],
  [/(^|\.)pinterest\.[a-z.]+$/, 'pinterest'],
  [/(^|\.)(t\.me|telegram\.me)$/, 'telegram'],
  [/(^|\.)reddit\.com$/, 'reddit'],
  [/(^|\.)(mastodon\.[a-z]+|mstdn\.[a-z]+)$/, 'mastodon'],
];

/** Guesses the network from a profile URL; anything unknown is a website. */
export function detectNetwork(url: string): SocialNetwork {
  if (/^mailto:/i.test(url)) return 'email';
  const host = /^https?:\/\/([^/?#]+)/i.exec(url.trim())?.[1]?.toLowerCase() ?? '';
  return NETWORK_HOSTS.find(([pattern]) => pattern.test(host))?.[1] ?? 'website';
}

export type SocialVariant = 'brand' | 'dark' | 'light';

/**
 * Where the social icon PNGs are served from: this package's own `assets/`
 * folder on jsDelivr, pinned to this version so sent emails keep working.
 * Pass `assetsUrl` to the renderer (or the editor) to host them yourself.
 */
export const DEFAULT_ASSETS_URL = `https://cdn.jsdelivr.net/npm/@maildun/email-builder@${version}/assets`;

export function socialIconUrl(
  assetsUrl: string,
  network: SocialNetwork,
  variant: SocialVariant,
): string {
  return `${assetsUrl.replace(/\/+$/, '')}/social/${variant}/${network}.png`;
}
