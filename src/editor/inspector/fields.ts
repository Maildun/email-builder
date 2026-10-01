import type { BlockType } from '../../core/schema/blocks';
import { FONT_FAMILIES, FONT_KEYS } from '../../core/schema/primitives';

export type Scope = 'props' | 'style';

interface BaseField {
  key: string;
  scope: Scope;
  label: string;
  hint?: string;
}

export type FieldSpec =
  | (BaseField & { kind: 'text'; placeholder?: string })
  | (BaseField & { kind: 'textarea'; rows?: number; mono?: boolean; placeholder?: string })
  | (BaseField & { kind: 'url'; placeholder?: string })
  | (BaseField & { kind: 'image' })
  | (BaseField & {
      kind: 'number';
      min?: number;
      max?: number;
      step?: number;
      unit?: string;
      placeholder?: string;
    })
  | (BaseField & { kind: 'select'; options: Array<{ value: string; label: string }> })
  | (BaseField & { kind: 'segmented'; options: Array<{ value: string; label: string }> })
  | (BaseField & { kind: 'switch' })
  | (BaseField & { kind: 'color'; allowClear?: boolean })
  | (BaseField & { kind: 'padding' })
  | (BaseField & { kind: 'imageWidth' });

export interface FieldGroup {
  title: string;
  fields: FieldSpec[];
}

export const FONT_OPTIONS = FONT_KEYS.map((key) => ({
  value: key,
  label: FONT_FAMILIES[key].label,
}));

const ALIGN = {
  key: 'align',
  scope: 'style',
  label: 'Alignment',
  kind: 'segmented',
  options: [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' },
  ],
} as const satisfies FieldSpec;

const BOX: FieldSpec[] = [
  { key: 'padding', scope: 'style', label: 'Padding', kind: 'padding' },
  { key: 'backgroundColor', scope: 'style', label: 'Background', kind: 'color', allowClear: true },
  {
    key: 'borderRadius',
    scope: 'style',
    label: 'Corner radius',
    kind: 'number',
    min: 0,
    max: 100,
    unit: 'px',
  },
];

const TYPOGRAPHY: FieldSpec[] = [
  { key: 'color', scope: 'style', label: 'Text color', kind: 'color', allowClear: true },
  {
    key: 'fontFamily',
    scope: 'style',
    label: 'Font',
    kind: 'select',
    options: [{ value: '', label: 'Theme font' }, ...FONT_OPTIONS],
  },
  {
    key: 'fontSize',
    scope: 'style',
    label: 'Font size',
    kind: 'number',
    min: 8,
    max: 96,
    unit: 'px',
    placeholder: 'Default',
  },
  {
    key: 'fontWeight',
    scope: 'style',
    label: 'Weight',
    kind: 'segmented',
    options: [
      { value: 'normal', label: 'Regular' },
      { value: 'bold', label: 'Bold' },
    ],
  },
  {
    key: 'lineHeight',
    scope: 'style',
    label: 'Line height',
    kind: 'number',
    min: 0.8,
    max: 3,
    step: 0.05,
    placeholder: 'Default',
  },
];

/** Inspector layout for each block type. */
export const BLOCK_FIELDS: Record<BlockType, FieldGroup[]> = {
  heading: [
    {
      title: 'Content',
      fields: [
        {
          key: 'text',
          scope: 'props',
          label: 'Text',
          kind: 'textarea',
          rows: 2,
          hint: 'Inline markdown: **bold**, *italic*, [link](https://…)',
        },
        {
          key: 'level',
          scope: 'props',
          label: 'Level',
          kind: 'segmented',
          options: [
            { value: '1', label: 'H1' },
            { value: '2', label: 'H2' },
            { value: '3', label: 'H3' },
          ],
        },
      ],
    },
    { title: 'Typography', fields: [ALIGN, ...TYPOGRAPHY] },
    { title: 'Box', fields: BOX },
  ],
  text: [
    {
      title: 'Content',
      fields: [
        {
          key: 'markdown',
          scope: 'props',
          label: 'Text',
          kind: 'textarea',
          rows: 8,
          hint: 'Double-click the block to edit in place. Markdown: **bold**, *italic*, [link](https://…), - lists',
        },
      ],
    },
    { title: 'Typography', fields: [ALIGN, ...TYPOGRAPHY] },
    { title: 'Box', fields: BOX },
  ],
  button: [
    {
      title: 'Content',
      fields: [
        { key: 'text', scope: 'props', label: 'Label', kind: 'text' },
        { key: 'href', scope: 'props', label: 'Link', kind: 'url' },
      ],
    },
    {
      title: 'Button',
      fields: [
        { key: 'buttonColor', scope: 'props', label: 'Button color', kind: 'color' },
        { key: 'textColor', scope: 'props', label: 'Label color', kind: 'color' },
        {
          key: 'shape',
          scope: 'props',
          label: 'Shape',
          kind: 'segmented',
          options: [
            { value: 'rectangle', label: 'Square' },
            { value: 'rounded', label: 'Rounded' },
            { value: 'pill', label: 'Pill' },
          ],
        },
        {
          key: 'size',
          scope: 'props',
          label: 'Size',
          kind: 'segmented',
          options: [
            { value: 'xs', label: 'XS' },
            { value: 'sm', label: 'S' },
            { value: 'md', label: 'M' },
            { value: 'lg', label: 'L' },
          ],
        },
        { key: 'fullWidth', scope: 'props', label: 'Full width', kind: 'switch' },
        ALIGN,
        {
          key: 'fontFamily',
          scope: 'style',
          label: 'Font',
          kind: 'select',
          options: [{ value: '', label: 'Theme font' }, ...FONT_OPTIONS],
        },
        {
          key: 'fontSize',
          scope: 'style',
          label: 'Font size',
          kind: 'number',
          min: 8,
          max: 96,
          unit: 'px',
          placeholder: 'Auto',
        },
      ],
    },
    { title: 'Box', fields: BOX },
  ],
  image: [
    {
      title: 'Image',
      fields: [
        { key: 'src', scope: 'props', label: 'Source', kind: 'image' },
        {
          key: 'alt',
          scope: 'props',
          label: 'Alt text',
          kind: 'text',
          hint: 'Describe the image for screen readers and blocked images.',
        },
        { key: 'href', scope: 'props', label: 'Link', kind: 'url' },
        { key: 'width', scope: 'props', label: 'Width', kind: 'imageWidth' },
        ALIGN,
      ],
    },
    { title: 'Box', fields: BOX },
  ],
  avatar: [
    {
      title: 'Avatar',
      fields: [
        { key: 'src', scope: 'props', label: 'Source', kind: 'image' },
        { key: 'alt', scope: 'props', label: 'Alt text', kind: 'text' },
        {
          key: 'size',
          scope: 'props',
          label: 'Size',
          kind: 'number',
          min: 16,
          max: 256,
          unit: 'px',
        },
        {
          key: 'shape',
          scope: 'props',
          label: 'Shape',
          kind: 'segmented',
          options: [
            { value: 'circle', label: 'Circle' },
            { value: 'rounded', label: 'Rounded' },
            { value: 'square', label: 'Square' },
          ],
        },
        ALIGN,
      ],
    },
    { title: 'Box', fields: BOX },
  ],
  divider: [
    {
      title: 'Line',
      fields: [
        { key: 'color', scope: 'props', label: 'Color', kind: 'color' },
        {
          key: 'thickness',
          scope: 'props',
          label: 'Thickness',
          kind: 'number',
          min: 1,
          max: 24,
          unit: 'px',
        },
        {
          key: 'width',
          scope: 'props',
          label: 'Width',
          kind: 'number',
          min: 1,
          max: 100,
          unit: '%',
        },
      ],
    },
    { title: 'Box', fields: BOX },
  ],
  spacer: [
    {
      title: 'Spacer',
      fields: [
        {
          key: 'height',
          scope: 'props',
          label: 'Height',
          kind: 'number',
          min: 1,
          max: 400,
          unit: 'px',
        },
      ],
    },
    { title: 'Box', fields: BOX },
  ],
  html: [
    {
      title: 'HTML',
      fields: [
        {
          key: 'html',
          scope: 'props',
          label: 'Markup',
          kind: 'textarea',
          rows: 10,
          mono: true,
          hint: 'Inserted as-is. Keep it email-safe: tables and inline styles.',
        },
      ],
    },
    { title: 'Typography', fields: [ALIGN, ...TYPOGRAPHY] },
    { title: 'Box', fields: BOX },
  ],
  container: [{ title: 'Box', fields: [ALIGN, ...BOX] }],
  columns: [
    {
      title: 'Columns',
      fields: [
        { key: 'gap', scope: 'props', label: 'Gap', kind: 'number', min: 0, max: 80, unit: 'px' },
        {
          key: 'verticalAlign',
          scope: 'props',
          label: 'Vertical alignment',
          kind: 'segmented',
          options: [
            { value: 'top', label: 'Top' },
            { value: 'middle', label: 'Middle' },
            { value: 'bottom', label: 'Bottom' },
          ],
        },
        { key: 'stackOnMobile', scope: 'props', label: 'Stack on mobile', kind: 'switch' },
      ],
    },
    { title: 'Box', fields: BOX },
  ],
  column: [
    {
      title: 'Column',
      fields: [
        {
          key: 'width',
          scope: 'props',
          label: 'Width',
          kind: 'number',
          min: 5,
          max: 100,
          unit: '%',
          placeholder: 'Auto',
        },
      ],
    },
    { title: 'Box', fields: BOX },
  ],
};
