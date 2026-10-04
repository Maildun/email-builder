// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createDocument, defineBlock, type EmailDocument, renderEmail } from '../../src';
import { runTool } from '../../src/agent';
import { EmailEditor, type EmailEditorHandle, EN_MESSAGES } from '../../src/editor';
import { resolveDrop } from '../../src/editor/dnd';
import { insertionPoint } from '../../src/editor/panels/Sidebar';

afterEach(cleanup);

const doc = () =>
  createDocument({
    blocks: [
      { id: 'title', type: 'heading', props: { text: 'Hello world' } },
      {
        id: 'row',
        type: 'columns',
        children: [
          { id: 'left', type: 'column' },
          { id: 'right', type: 'column', children: [{ id: 'cta', type: 'button' }] },
        ],
      },
    ],
  });

describe('<EmailEditor>', () => {
  it('previews desktop above the mobile breakpoint and mobile below it', () => {
    const editor = createRef<EmailEditorHandle>();
    const { container } = render(<EmailEditor ref={editor} defaultValue={doc()} />);
    act(() => editor.current?.store.setView('preview'));
    const frame = () => container.querySelector<HTMLElement>('[data-slot="preview-frame"]');
    // The iframe fills the frame's content box; its width is the email's viewport.
    const viewportWidth = () => {
      const style = frame()?.style;
      return (
        Number.parseFloat(style?.maxWidth ?? '0') -
        2 * Number.parseFloat(style?.paddingInline || '0')
      );
    };
    const breakpoint = Number(
      /max-width:(\d+)px\)\{/.exec(renderEmail(doc()).html)?.[1] ?? Number.NaN,
    );
    expect(viewportWidth()).toBeGreaterThan(breakpoint);
    act(() => editor.current?.store.setViewport('mobile'));
    expect(viewportWidth()).toBe(375);
    expect(viewportWidth()).toBeLessThanOrEqual(breakpoint);
  });

  it('renders the email on the canvas and inserts blocks from the palette', () => {
    const onChange = vi.fn();
    const { container } = render(<EmailEditor defaultValue={doc()} onChange={onChange} />);
    expect(container.querySelector('[data-block-id="title"]')?.textContent).toContain(
      'Hello world',
    );

    fireEvent.click(screen.getByRole('button', { name: /divider/i }));
    const latest = onChange.mock.lastCall?.[0] as EmailDocument;
    expect(latest.root).toHaveLength(3);
    expect(latest.blocks[latest.root[2] as string]?.type).toBe('divider');
  });

  it('selects a block on click and shows its inspector', () => {
    const { container } = render(<EmailEditor defaultValue={doc()} />);
    fireEvent.click(container.querySelector('[data-block-id="cta"]') as Element);
    const inspector = screen.getByRole('complementary', { name: 'Inspector' });
    expect(within(inspector).getByRole('heading', { name: 'Button', level: 2 })).toBeTruthy();
    expect(within(inspector).getByDisplayValue('Get started')).toBeTruthy();
  });

  it('edits props from the inspector and supports undo', () => {
    const ref = createRef<EmailEditorHandle>();
    const { container } = render(<EmailEditor ref={ref} defaultValue={doc()} />);
    fireEvent.click(container.querySelector('[data-block-id="cta"]') as Element);
    fireEvent.change(screen.getByDisplayValue('Get started'), { target: { value: 'Buy now' } });
    expect(ref.current?.getDocument().blocks.cta?.props).toMatchObject({ text: 'Buy now' });
    act(() => ref.current?.undo());
    expect(ref.current?.getDocument().blocks.cta?.props).toMatchObject({ text: 'Get started' });
  });

  it('shows validation errors for invalid URLs without committing them', () => {
    const ref = createRef<EmailEditorHandle>();
    const { container } = render(<EmailEditor ref={ref} defaultValue={doc()} />);
    fireEvent.click(container.querySelector('[data-block-id="cta"]') as Element);
    fireEvent.change(screen.getByDisplayValue('https://example.com'), {
      target: { value: 'javascript:alert(1)' },
    });
    expect(screen.getByText(/URLs must start with/)).toBeTruthy();
    expect(ref.current?.getDocument().blocks.cta?.props).toMatchObject({
      href: 'https://example.com',
    });
  });

  it('deletes the selected block with the keyboard', () => {
    const ref = createRef<EmailEditorHandle>();
    const { container } = render(<EmailEditor ref={ref} defaultValue={doc()} />);
    const title = container.querySelector('[data-block-id="title"]') as Element;
    fireEvent.click(title);
    fireEvent.keyDown(title, { key: 'Backspace' });
    expect(ref.current?.getDocument().blocks.title).toBeUndefined();
  });

  it('lets focused controls handle Enter and Backspace themselves', () => {
    const ref = createRef<EmailEditorHandle>();
    const { container } = render(<EmailEditor ref={ref} defaultValue={doc()} />);
    fireEvent.click(container.querySelector('[data-block-id="title"]') as Element);
    const inspector = screen.getByRole('complementary', { name: 'Inspector' });
    const level = within(inspector).getByRole('button', { name: 'H1' });
    fireEvent.keyDown(level, { key: 'Enter' });
    expect(ref.current?.store.getState().editingId).toBeNull();
    fireEvent.keyDown(level, { key: 'Backspace' });
    expect(ref.current?.getDocument().blocks.title).toBeDefined();
  });

  it('keeps focus in the editor after deleting from the block toolbar', () => {
    const ref = createRef<EmailEditorHandle>();
    const { container } = render(<EmailEditor ref={ref} defaultValue={doc()} />);
    fireEvent.click(container.querySelector('[data-block-id="title"]') as Element);
    const remove = within(container.querySelector('.meb-block-toolbar') as HTMLElement).getByRole(
      'button',
      { name: 'Delete' },
    );
    remove.focus();
    fireEvent.click(remove);
    expect(ref.current?.getDocument().blocks.title).toBeUndefined();
    expect(document.activeElement).toBe(container.querySelector('.meb-shell'));
  });

  it('lets number fields pass through out-of-range values while typing', () => {
    const ref = createRef<EmailEditorHandle>();
    render(<EmailEditor ref={ref} defaultValue={doc()} />);
    const size = screen.getByRole('spinbutton', { name: 'Base size' });
    fireEvent.change(size, { target: { value: '' } });
    fireEvent.change(size, { target: { value: '1' } });
    expect((size as HTMLInputElement).value).toBe('1');
    fireEvent.change(size, { target: { value: '14' } });
    expect(ref.current?.getDocument().settings.fontSize).toBe(14);
    fireEvent.change(size, { target: { value: '99' } });
    fireEvent.blur(size);
    expect(ref.current?.getDocument().settings.fontSize).toBe(24);
    expect((size as HTMLInputElement).value).toBe('24');
  });

  it('highlights proposed changes and applies them on accept', () => {
    const ref = createRef<EmailEditorHandle>();
    const onChange = vi.fn();
    const { container } = render(
      <EmailEditor ref={ref} defaultValue={doc()} onChange={onChange} />,
    );
    act(() => {
      ref.current?.propose(
        [{ op: 'update', id: 'title', props: { text: 'Proposed title' } }],
        'Retitled',
      );
    });
    expect(container.querySelector('[data-block-id="title"]')?.hasAttribute('data-changed')).toBe(
      true,
    );
    expect(screen.getByText('Retitled')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(ref.current?.getDocument().blocks.title?.props).toMatchObject({
      text: 'Proposed title',
    });
  });

  it('turns calls to the editor tools into a live proposal', () => {
    const ref = createRef<EmailEditorHandle>();
    const { container } = render(<EmailEditor ref={ref} defaultValue={doc()} />);
    const tools = ref.current?.tools() ?? [];
    act(() => {
      const result = runTool(tools, 'update_block', { id: 'title', props: { text: 'From my AI' } });
      expect(result.ok).toBe(true);
      ref.current?.setProposalSummary('Rewrote the heading.');
    });
    expect(ref.current?.store.getState().proposal?.document.blocks.title?.props).toMatchObject({
      text: 'From my AI',
    });
    // Nothing is committed until the user accepts.
    expect(ref.current?.getDocument().blocks.title?.props).not.toMatchObject({
      text: 'From my AI',
    });
    expect(container.querySelector('[data-block-id="title"]')?.hasAttribute('data-changed')).toBe(
      true,
    );
    expect(screen.getByText('Rewrote the heading.')).toBeTruthy();
    // Tools see the proposal, so follow-up calls build on it.
    act(() => {
      runTool(tools, 'remove_block', { id: 'row' });
    });
    expect(screen.getByText(/\d+ removed/)).toBeTruthy();
  });

  it('moves the selection with the arrow keys and announces it', () => {
    const ref = createRef<EmailEditorHandle>();
    const { container } = render(<EmailEditor ref={ref} defaultValue={doc()} />);
    const canvas = screen.getByRole('region', { name: /email canvas/i });
    fireEvent.keyDown(canvas, { key: 'ArrowDown' });
    expect(ref.current?.store.getState().selectedId).toBe('title');
    fireEvent.keyDown(canvas, { key: 'ArrowDown' });
    expect(ref.current?.store.getState().selectedId).toBe('row');
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    expect(ref.current?.store.getState().selectedId).toBe('left');
    fireEvent.keyDown(canvas, { key: 'ArrowLeft' });
    expect(ref.current?.store.getState().selectedId).toBe('row');
    expect(screen.getByText('Columns selected')).toBeTruthy();
    expect(container.querySelector('[data-block-id="row"]')?.getAttribute('aria-label')).toMatch(
      /^Columns/,
    );
  });

  it('offers Undo after deleting a block', () => {
    const ref = createRef<EmailEditorHandle>();
    const { container } = render(<EmailEditor ref={ref} defaultValue={doc()} />);
    const title = container.querySelector('[data-block-id="title"]') as Element;
    fireEvent.click(title);
    fireEvent.keyDown(title, { key: 'Backspace' });
    expect(screen.getByText('Heading deleted')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo: Heading deleted' }));
    expect(ref.current?.getDocument().blocks.title).toBeDefined();
  });

  it('summarizes theme changes in the review bar and discards them on reject', () => {
    const ref = createRef<EmailEditorHandle>();
    render(<EmailEditor ref={ref} defaultValue={doc()} />);
    act(() => {
      ref.current?.propose([{ op: 'updateTheme', colors: { primary: '#7c3aed' } }]);
    });
    expect(screen.getByText('Theme updated')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    expect(ref.current?.store.getState().proposal).toBeNull();
    expect(ref.current?.getDocument().theme.colors.primary).not.toBe('#7c3aed');
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull();
  });

  it('composes a custom layout from the parts', () => {
    const ref = createRef<EmailEditorHandle>();
    render(
      <EmailEditor.Root ref={ref} defaultValue={doc()}>
        <header>My header</header>
        <EmailEditor.Stage />
        <EmailEditor.Inspector />
      </EmailEditor.Root>,
    );
    expect(screen.getByText('My header')).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: 'Blocks and layers' })).toBeNull();
    expect(screen.getByRole('region', { name: /email canvas/i })).toBeTruthy();
  });

  it('limits the palette and views, and reports selection and save', () => {
    const onSelectionChange = vi.fn();
    const onSave = vi.fn();
    const { container } = render(
      <EmailEditor
        defaultValue={doc()}
        blockTypes={['text', 'image']}
        sections={[]}
        views={['design', 'preview']}
        onSelectionChange={onSelectionChange}
        onSave={onSave}
      />,
    );
    const sidebar = screen.getByRole('complementary', { name: 'Blocks and layers' });
    expect(within(sidebar).queryByRole('button', { name: /divider/i })).toBeNull();
    expect(within(sidebar).getByRole('button', { name: /text/i })).toBeTruthy();
    expect(within(sidebar).queryByText('Sections')).toBeNull();
    expect(screen.queryByRole('button', { name: /code/i })).toBeNull();

    fireEvent.click(container.querySelector('[data-block-id="cta"]') as Element);
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      'cta',
      expect.objectContaining({ type: 'button' }),
    );
    fireEvent.keyDown(container.querySelector('.meb-shell') as Element, {
      key: 's',
      metaKey: true,
    });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ root: ['title', 'row'] }));
  });

  it('loads another document without its undo history', () => {
    const ref = createRef<EmailEditorHandle>();
    render(<EmailEditor ref={ref} defaultValue={doc()} />);
    act(() => {
      ref.current?.apply({ op: 'remove', id: 'title' });
    });
    act(() => {
      ref.current?.load(createDocument({ blocks: [{ id: 'only', type: 'text' }] }));
    });
    expect(ref.current?.store.getState().canUndo).toBe(false);
    expect(ref.current?.getDocument().root).toEqual(['only']);
  });

  it('inserts and edits custom blocks', () => {
    const card = defineBlock({
      name: 'promo',
      label: 'Promo',
      description: 'A promo code.',
      schema: z.object({ code: z.string().min(1) }),
      defaults: { code: 'SPRING' },
      fields: [{ key: 'code', label: 'Code', type: 'text' }],
      render: (data, ctx) => `<p>Use ${ctx.escape(data.code)}</p>`,
    });
    const ref = createRef<EmailEditorHandle>();
    const { container } = render(
      <EmailEditor ref={ref} defaultValue={doc()} customBlocks={[card]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^promo$/i }));
    const block = container.querySelector('[data-block-type="custom"]');
    expect(block?.textContent).toContain('Use SPRING');
    fireEvent.change(screen.getByDisplayValue('SPRING'), { target: { value: 'SUMMER' } });
    expect(block?.textContent).toContain('Use SUMMER');
    expect(ref.current?.render().html).toContain('Use SUMMER');
  });

  it('follows a controlled value', () => {
    const first = doc();
    const { container, rerender } = render(<EmailEditor value={first} />);
    const next = createDocument({
      blocks: [{ id: 'only', type: 'text', props: { markdown: 'Replaced' } }],
    });
    rerender(<EmailEditor value={next} />);
    expect(container.querySelector('[data-block-id="only"]')?.textContent).toContain('Replaced');
  });

  it('shows translated messages over the English defaults', () => {
    const { container } = render(
      <EmailEditor
        defaultValue={doc()}
        messages={{
          topBar: { undo: 'Urungkan' },
          blocks: { divider: { label: 'Pemisah' } },
          toast: { deleted: (label) => `${label} dihapus` },
        }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Urungkan' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.getByRole('button', { name: /Pemisah/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Divider$/ })).toBeNull();
    // Untranslated messages keep their English text, and the divider keeps its description.
    expect(screen.getByRole('button', { name: 'Redo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pemisah/ }).getAttribute('title')).toBe(
      EN_MESSAGES.blocks.divider.description,
    );

    const title = container.querySelector('[data-block-id="title"]') as Element;
    fireEvent.click(title);
    fireEvent.keyDown(title, { key: 'Backspace' });
    expect(screen.getByText('Heading dihapus')).toBeTruthy();
  });
});

describe('placement helpers', () => {
  it('inserts into the selected container, after a selected leaf, or at the end', () => {
    const d = doc();
    expect(insertionPoint(d, 'left', 'text')).toEqual({ parentId: 'left', index: 0 });
    expect(insertionPoint(d, 'cta', 'text')).toEqual({ parentId: 'right', index: 1 });
    expect(insertionPoint(d, null, 'text')).toEqual({ parentId: 'root', index: 2 });
    expect(insertionPoint(d, 'row', 'text')).toEqual({ parentId: 'root', index: 2 });
  });

  it('resolves drops and rejects invalid ones', () => {
    const d = doc();
    expect(resolveDrop(d, { kind: 'new', blockType: 'text' }, 'inside', 'left')).toEqual({
      parentId: 'left',
      index: 0,
    });
    expect(resolveDrop(d, { kind: 'new', blockType: 'text' }, 'before', 'left')).toBeNull();
    expect(
      resolveDrop(d, { kind: 'move', id: 'row', blockType: 'columns' }, 'inside', 'left'),
    ).toBeNull();
    expect(
      resolveDrop(d, { kind: 'move', id: 'title', blockType: 'heading' }, 'after', 'row'),
    ).toEqual({ parentId: 'root', index: 1 });
    expect(
      resolveDrop(d, { kind: 'move', id: 'title', blockType: 'heading' }, 'before', 'title'),
    ).toBeNull();
  });
});
