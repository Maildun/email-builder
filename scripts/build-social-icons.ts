/**
 * Generates the social icon PNGs in assets/social/. Email clients don't show
 * SVG, so the social block links to these images (served from jsDelivr by
 * default; see DEFAULT_ASSETS_URL). Run after adding a network:
 *
 *   bun scripts/build-social-icons.ts
 *
 * Glyphs come from simple-icons (CC0) and Bootstrap Icons (MIT). Each icon is
 * a square tile; the renderer rounds it with CSS (circle, rounded, square).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import {
  type SimpleIcon,
  siBluesky,
  siDiscord,
  siFacebook,
  siGithub,
  siInstagram,
  siMastodon,
  siPinterest,
  siReddit,
  siTelegram,
  siThreads,
  siTiktok,
  siWhatsapp,
  siX,
  siYoutube,
} from 'simple-icons';
import { SOCIAL_NETWORKS, type SocialNetwork } from '../src/core/social';

/** 2× the largest size the social block allows (48px), for sharp retina icons. */
const TILE = 96;
const GLYPH = 48;

const VARIANTS = {
  brand: (brand: string) => ({ background: brand, glyph: '#ffffff' }),
  dark: () => ({ background: '#18181b', glyph: '#ffffff' }),
  light: () => ({ background: '#f4f4f5', glyph: '#27272a' }),
} as const;

interface Glyph {
  /** SVG markup of the glyph's shapes, drawn in `currentColor`. */
  body: string;
  viewBox: string;
  brand: string;
}

function simpleIcon(icon: SimpleIcon): Glyph {
  return {
    body: `<path d="${icon.path}" fill="currentColor"/>`,
    viewBox: '0 0 24 24',
    brand: `#${icon.hex}`,
  };
}

function bootstrapIcon(name: string, brand: string): Glyph {
  const svg = readFileSync(
    fileURLToPath(import.meta.resolve(`bootstrap-icons/icons/${name}.svg`)),
    'utf8',
  );
  const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return {
    body: body.replaceAll('<path ', '<path fill="currentColor" '),
    viewBox: '0 0 16 16',
    brand,
  };
}

const GLYPHS: Record<SocialNetwork, () => Glyph> = {
  x: () => simpleIcon(siX),
  facebook: () => simpleIcon(siFacebook),
  instagram: () => simpleIcon(siInstagram),
  // simple-icons dropped LinkedIn at the brand's request.
  linkedin: () => bootstrapIcon('linkedin', '#0a66c2'),
  youtube: () => simpleIcon(siYoutube),
  tiktok: () => simpleIcon(siTiktok),
  threads: () => simpleIcon(siThreads),
  bluesky: () => simpleIcon(siBluesky),
  github: () => simpleIcon(siGithub),
  discord: () => simpleIcon(siDiscord),
  whatsapp: () => simpleIcon(siWhatsapp),
  pinterest: () => simpleIcon(siPinterest),
  telegram: () => simpleIcon(siTelegram),
  mastodon: () => simpleIcon(siMastodon),
  reddit: () => simpleIcon(siReddit),
  website: () => bootstrapIcon('globe2', '#52525b'),
  email: () => bootstrapIcon('envelope-fill', '#52525b'),
};

const out = fileURLToPath(new URL('../assets/social/', import.meta.url));
let count = 0;
for (const network of SOCIAL_NETWORKS) {
  const glyph = GLYPHS[network]();
  for (const [variant, colors] of Object.entries(VARIANTS)) {
    const { background, glyph: color } = colors(glyph.brand);
    const offset = (TILE - GLYPH) / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}"><rect width="${TILE}" height="${TILE}" fill="${background}"/><svg x="${offset}" y="${offset}" width="${GLYPH}" height="${GLYPH}" viewBox="${glyph.viewBox}" color="${color}">${glyph.body}</svg></svg>`;
    const png = new Resvg(svg).render().asPng();
    mkdirSync(`${out}${variant}`, { recursive: true });
    writeFileSync(`${out}${variant}/${network}.png`, png);
    count += 1;
  }
}
console.log(`Wrote ${count} icons to assets/social/`);
