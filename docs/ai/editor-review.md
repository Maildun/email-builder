# AI in the editor

The editor has no built-in chat. Bring your own AI experience (a side panel, a command menu, a "Write it for me" button) and let the editor handle **review**:

- Changes your AI makes arrive as a **proposal**. The canvas highlights changed and added blocks and marks removed ones.
- A review bar summarizes the proposal (blocks, removals, theme, settings) with **Show** to step through each change, and **Accept** / **Reject**.
- Accepting applies everything as **one undoable step**. `onChange` only fires once the user accepts.

## Run the model against the editor

`editor.tools()` returns the [agent tools](./agents) bound to the editor. Every successful call adds to the proposal, live, so the user watches the email change while your model works:

```tsx
import { useRef } from 'react';
import { runTool } from '@maildun/email-builder/agent';
import { EmailEditor, type EmailEditorHandle } from '@maildun/email-builder/editor';

function Compose() {
  const editor = useRef<EmailEditorHandle>(null);

  async function ask(prompt: string) {
    const tools = editor.current!.tools();
    // Your loop: send `prompt` and the tool definitions to your model,
    // then run each tool call it makes:
    for await (const call of toolCallsFromYourModel(prompt, tools)) {
      const result = runTool(tools, call.name, call.input);
      call.respond(result.content, !result.ok);
    }
    editor.current!.setProposalSummary('Added a spring sale hero.');
  }

  return <EmailEditor ref={editor} defaultValue={design} onChange={setDesign} />;
}
```

Your API key should stay on your server. A common setup is to run the model there and relay its tool calls to the browser (over a stream or WebSocket), where `runTool` applies them to the editor and sends the results back.

## Or propose operations from your server

If your server runs the whole loop with [`createAgentSession`](./agents#sessions-and-stores), send the resulting `session.ops` to the browser and propose them in one go:

```ts
const { ops, summary } = await fetch('/api/ai/edit', { method: 'POST', body: JSON.stringify({ prompt, design }) })
  .then((res) => res.json());

const result = editor.current!.propose(ops, summary);
if (!result.ok) console.error(result.issues);
```

The operations carry explicit ids, so they replay to exactly what the model produced.

## Reacting to proposals

```tsx
<EmailEditor
  onProposalChange={(proposal) => {
    // null once the user accepts or rejects
    setReviewing(proposal !== null);
  }}
/>
```

A `Proposal` has the proposed `document`, `changed` and `removed` block ids, `themeChanged`, `settingsChanged`, the `ops`, and an optional `label` and `summary`. Calls to `propose` and tool calls add up into one proposal until it's resolved. Resolve it in code with `editor.accept()` or `editor.reject()`.

## Adding your own actions

`proposalActions` puts your controls in the review bar, before **Reject**. For example, let the user trust your AI from now on and apply its changes directly:

```tsx
<EmailEditor
  ref={editor}
  proposalActions={() => (
    <Button
      onClick={() => {
        setAutoApply(true); // your setting: next time, apply with editor.apply() instead of proposing
        editor.current?.accept();
      }}
    >
      Always allow
    </Button>
  )}
/>
```

A function gets the pending `Proposal`, so the label can name its source.

## Try it

The repository's playground has a **Propose a change** button that calls `editor.tools()` the way your AI would. See [Contributing](/contributing#playground) to run it.
