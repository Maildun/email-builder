import type { CustomBlockDefinition } from '../../core/custom';
import type { BlockType } from '../../core/schema/blocks';
import { FONT_FAMILIES, FONT_KEYS } from '../../core/schema/primitives';

/** Where a field's value lives: block props, block style, or a custom block's `props.data`. */
export type Scope = 'props' | 'style' | 'data';

interface BaseField {
  key: string;
  scope: Scope;
  label: string;
  hint?: string;
  /** Another value this field resets when changed, e.g. a shape clears a custom radius. */
  clears?: { scope: Scope; key: string };
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
  | (BaseField & { kind: 'json' })
  /** Fill, natural size or fixed px; `natural: false` hides the natural option. */
  | (BaseField & { kind: 'imageWidth'; natural?: boolean })
  | (BaseField & { kind: 'socialLinks' });

export interface FieldGroup {
  title: string;
  fields: FieldSpec[];
}

/** Select value meaning "unset, use the default" (Base UI treats '' as no selection). */
export const DEFAULT_OPTION = '__default';

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

/**
 * Corner radius of the block itself (button, avatar), overriding its shape.
 * Their box styles leave the radius out, so there is one radius control.
 */
const OWN_RADIUS = {
  key: 'borderRadius',
  scope: 'style',
  label: 'Corner radius',
  kind: 'number',
  min: 0,
  max: 100,
  unit: 'px',
  placeholder: 'From shape',
} as const satisfies FieldSpec;

const CLEARS_RADIUS = { clears: { scope: 'style', key: 'borderRadius' } } as const;

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

/** Box styles for blocks with their own corner radius (see `OWN_RADIUS`). */
const BOX_WITHOUT_RADIUS = BOX.filter((field) => field.key !== 'borderRadius');

const TYPOGRAPHY: FieldSpec[] = [
  { key: 'color', scope: 'style', label: 'Text color', kind: 'color', allowClear: true },
  {
    key: 'fontFamily',
    scope: 'style',
    label: 'Font',
    kind: 'select',
    options: [{ value: DEFAULT_OPTION, label: 'Theme font' }, ...FONT_OPTIONS],
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
          ...CLEARS_RADIUS,
        },
        OWN_RADIUS,
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
          options: [{ value: DEFAULT_OPTION, label: 'Theme font' }, ...FONT_OPTIONS],
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
    { title: 'Box', fields: BOX_WITHOUT_RADIUS },
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
  social: [
    {
      title: 'Social',
      fields: [{ key: 'links', scope: 'props', label: 'Links', kind: 'socialLinks' }],
    },
    {
      title: 'Icons',
      fields: [
        {
          key: 'variant',
          scope: 'props',
          label: 'Style',
          kind: 'segmented',
          options: [
            { value: 'brand', label: 'Brand' },
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ],
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
        {
          key: 'size',
          scope: 'props',
          label: 'Size',
          kind: 'number',
          min: 16,
          max: 48,
          unit: 'px',
        },
        {
          key: 'gap',
          scope: 'props',
          label: 'Spacing',
          kind: 'number',
          min: 0,
          max: 32,
          unit: 'px',
        },
        ALIGN,
      ],
    },
    { title: 'Box', fields: BOX },
  ],
  video: [
    {
      title: 'Video',
      fields: [
        {
          key: 'url',
          scope: 'props',
          label: 'Video link',
          kind: 'url',
          placeholder: 'https://youtube.com/watch?v=…',
        },
        {
          key: 'thumbnail',
          scope: 'props',
          label: 'Thumbnail',
          kind: 'image',
          hint: 'YouTube links use the video’s HD thumbnail when this is empty.',
        },
        {
          key: 'alt',
          scope: 'props',
          label: 'Alt text',
          kind: 'text',
          hint: 'Read out by screen readers, e.g. “Watch: product tour”.',
        },
        { key: 'width', scope: 'props', label: 'Width', kind: 'imageWidth', natural: false },
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
          ...CLEARS_RADIUS,
        },
        OWN_RADIUS,
        ALIGN,
      ],
    },
    { title: 'Box', fields: BOX_WITHOUT_RADIUS },
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
  custom: [{ title: 'Box', fields: [ALIGN, ...BOX] }],
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

/** Inspector fields for a custom block: its own fields, or a JSON editor when it has none. */
export function customFieldGroups(definition: CustomBlockDefinition): FieldGroup[] {
  if (!definition.fields?.length) {
    return [
      {
        title: definition.label,
        fields: [
          {
            key: 'data',
            scope: 'props',
            label: 'Data (JSON)',
            kind: 'json',
            hint: definition.description,
          },
        ],
      },
    ];
  }
  return [
    {
      title: definition.label,
      fields: definition.fields.map((field): FieldSpec => {
        const base = {
          key: field.key,
          scope: 'data' as const,
          label: field.label,
          ...(field.hint ? { hint: field.hint } : {}),
        };
        const placeholder = field.placeholder ? { placeholder: field.placeholder } : {};
        switch (field.type) {
          case 'number':
            return {
              ...base,
              ...placeholder,
              kind: 'number',
              ...(field.min !== undefined ? { min: field.min } : {}),
              ...(field.max !== undefined ? { max: field.max } : {}),
              ...(field.step !== undefined ? { step: field.step } : {}),
              ...(field.unit ? { unit: field.unit } : {}),
            };
          case 'select':
            return { ...base, kind: 'select', options: field.options ?? [] };
          case 'color':
            return { ...base, kind: 'color', allowClear: true };
          case 'switch':
            return { ...base, kind: 'switch' };
          case 'image':
            return { ...base, kind: 'image' };
          case 'textarea':
            return { ...base, ...placeholder, kind: 'textarea' };
          case 'url':
            return { ...base, ...placeholder, kind: 'url' };
          default:
            return { ...base, ...placeholder, kind: 'text' };
        }
      }),
    },
  ];
}
