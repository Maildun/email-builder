// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocument, type EmailDocument } from '../../src';
import { EmailEditor, type EmailEditorHandle } from '../../src/editor';
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
    expect(within(inspector).getByText('Button', { selector: 'h2' })).toBeTruthy();
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

  it('follows a controlled value', () => {
    const first = doc();
    const { container, rerender } = render(<EmailEditor value={first} />);
    const next = createDocument({
      blocks: [{ id: 'only', type: 'text', props: { markdown: 'Replaced' } }],
    });
    rerender(<EmailEditor value={next} />);
    expect(container.querySelector('[data-block-id="only"]')?.textContent).toContain('Replaced');
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
