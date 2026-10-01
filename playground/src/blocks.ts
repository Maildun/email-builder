import { ShoppingCart01Icon } from '@hugeicons/core-free-icons';
import { z } from 'zod';
// Relative import (instead of '@maildun/email-builder') because the server
// middleware loads this file too, before Vite's aliases apply.
import { defineBlock } from '../../src';

/** A custom block: a product card, as a store integration might add. */
export const productCard = defineBlock({
  name: 'product-card',
  label: 'Product',
  description: 'A product with its image, name, price and a buy button.',
  category: 'content',
  icon: ShoppingCart01Icon,
  schema: z.object({
    name: z.string().min(1).max(120),
    price: z.string().max(40),
    image: z.string().url(),
    href: z.string().url(),
    badge: z.string().max(24).optional(),
  }),
  defaults: {
    name: 'Ceramic pour-over set',
    price: '$48',
    image: 'https://picsum.photos/seed/pourover/600/400',
    href: 'https://example.com/products/pour-over',
    badge: 'New',
  },
  fields: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'price', label: 'Price', type: 'text', placeholder: '$48' },
    { key: 'badge', label: 'Badge', type: 'text', hint: 'Short label like "New" or "-20%".' },
    { key: 'image', label: 'Image', type: 'image' },
    { key: 'href', label: 'Product link', type: 'url' },
  ],
  render: (data, ctx) => {
    const primary = ctx.color('$primary') ?? '#111111';
    const font = ctx.font(undefined);
    const badge = data.badge
      ? `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${primary};color:#ffffff;font-size:12px;font-weight:bold;">${ctx.escape(data.badge)}</span><br><br>`
      : '';
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${ctx.color('$border') ?? '#e5e7eb'};border-radius:8px;border-collapse:separate;">
<tr><td style="padding:0"><img src="${ctx.escape(data.image)}" width="${ctx.width}" alt="${ctx.escape(data.name)}" style="display:block;width:100%;max-width:${ctx.width}px;height:auto;border:0;border-radius:8px 8px 0 0;"></td></tr>
<tr><td style="padding:16px;font-family:${font};color:${ctx.textColor};">${badge}<strong style="font-size:18px;">${ctx.escape(data.name)}</strong><br><span style="font-size:16px;color:${ctx.color('$muted') ?? '#6b7280'};">${ctx.escape(data.price)}</span><br><br><a href="${ctx.escape(data.href)}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:${primary};color:#ffffff;text-decoration:none;font-weight:bold;">Buy now</a></td></tr>
</table>`;
  },
  text: (data) => `${data.name} – ${data.price}: ${data.href}`,
});

export const CUSTOM_BLOCKS = [productCard];
