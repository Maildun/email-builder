// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createDocument, defineBlock, type EmailDocument } from '../../src';
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
      <EmailEditor
        ref={ref}
        defaultValue={doc()}
        onChange={onChange}
        agent={{ onRequest: async () => undefined }}
      />,
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

  it('runs the agent and turns its ops into a proposal', async () => {
    const ref = createRef<EmailEditorHandle>();
    render(
      <EmailEditor
        ref={ref}
        defaultValue={doc()}
        agent={{
          onRequest: async (request) => {
            expect(request.prompt).toBe('remove the heading');
            return { ops: [{ op: 'remove', id: 'title' }], summary: 'Removed the heading.' };
          },
        }}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Ask the assistant' });
    fireEvent.change(input, { target: { value: 'remove the heading' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(ref.current?.store.getState().proposal?.summary).toBe('Removed the heading.');
    expect(ref.current?.getDocument().blocks.title).toBeDefined();
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

  it('summarizes theme changes in the proposal and passes the conversation to the agent', async () => {
    const requests: Array<{ prompt: string; history: unknown[] }> = [];
    const ref = createRef<EmailEditorHandle>();
    render(
      <EmailEditor
        ref={ref}
        defaultValue={doc()}
        agent={{
          onRequest: async (request) => {
            requests.push({ prompt: request.prompt, history: request.history });
            return { ops: [{ op: 'updateTheme', colors: { primary: '#7c3aed' } }] };
          },
        }}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Ask the assistant' });
    fireEvent.change(input, { target: { value: 'make it purple' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(screen.getByText('Theme updated')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /reject/i }));

    fireEvent.change(input, { target: { value: 'try green instead' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(requests[1]?.history).toEqual([{ prompt: 'make it purple', outcome: 'rejected' }]);
  });

  it('ignores tool calls that arrive after Stop', async () => {
    let finish: () => void = () => {};
    let late: (() => void) | undefined;
    const ref = createRef<EmailEditorHandle>();
    render(
      <EmailEditor
        ref={ref}
        defaultValue={doc()}
        agent={{
          onRequest: (request) =>
            new Promise((resolve) => {
              late = () => {
                request.propose([{ op: 'remove', id: 'title' }]);
              };
              finish = () => resolve(undefined);
            }),
        }}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Ask the assistant' });
    fireEvent.change(input, { target: { value: 'remove the heading' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await act(async () => {
      late?.();
      finish();
    });
    expect(ref.current?.store.getState().proposal).toBeNull();
    expect(screen.getByText('Stopped.')).toBeTruthy();
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
    fireEvent.click(screen.getByRole('button', { name: /promo/i }));
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
