export { Canvas } from './canvas/Canvas';
export {
  EditorProvider,
  type ImageResult,
  type MergeTag,
  useEditorState,
  useEditorStore,
  useVisibleDocument,
} from './context';
export { EmailEditor, type EmailEditorHandle, type EmailEditorProps } from './EmailEditor';
export type { AgentRequest, AgentResponse, AgentTurn, EditorAgent } from './panels/AgentPanel';
export {
  type ApplyOptions,
  type EditorState,
  EditorStore,
  type EditorView,
  type Proposal,
  type Viewport,
} from './store';
