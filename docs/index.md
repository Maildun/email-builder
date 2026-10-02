---
layout: home

hero:
  name: Email Builder
  text: Emails that people and AI can design together
  tagline: A typed document model, an operations API for LLM agents, an email-safe HTML renderer and a modern React editor. One package, MIT licensed.
  image:
    src: /logo.svg
    alt: Email Builder
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: What is it?
      link: /guide/introduction
    - theme: alt
      text: GitHub
      link: https://github.com/Maildun/email-builder

features:
  - icon: 🧱
    title: A document you can trust
    details: Emails are plain JSON with a Zod schema. Every change goes through validated, atomic, undoable operations, so a bad edit never corrupts a design.
    link: /guide/document
  - icon: 📨
    title: HTML that survives inboxes
    details: A pure TypeScript renderer turns a document into Outlook-, Gmail- and mobile-safe HTML plus a plain-text version. No React, no DOM; it runs anywhere.
    link: /guide/rendering
  - icon: 🤖
    title: Built for agents
    details: Provider-neutral tools, a system prompt generated from the schemas, and error messages written so a model can fix its own mistakes.
    link: /ai/agents
  - icon: ✨
    title: An editor people enjoy
    details: Drag and drop, inline rich text, live mobile preview, undo/redo, keyboard shortcuts, dark mode, translations and a shadcn/ui look that matches your app.
    link: /editor/
  - icon: 👀
    title: Review what the AI changed
    details: Edits from your AI arrive as a proposal. The canvas highlights them and the user accepts or rejects them in one step.
    link: /ai/editor-review
  - icon: 🔌
    title: MCP server included
    details: Run `email-builder mcp` and Claude, Cursor or any MCP client can design emails in a folder of JSON files.
    link: /ai/mcp
---
