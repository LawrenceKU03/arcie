/**
 * arcie/ui — the Arcie UI standard: React kit + hooks.
 *
 * `useChat` is the headless core (no styling). The components are the
 * batteries-included kit built on top. Consumers import components AND
 * `arcie/ui/styles.css` for the compiled styles. See UI_STANDARD.md.
 */

// ── Hooks ────────────────────────────────────────────────────────
export { useChat } from "../hooks/use-chat";
export type { UseChatOptions, UseChatResult } from "../hooks/use-chat";

// ── Components ───────────────────────────────────────────────────
export { AgentChat, type AgentChatProps } from "../App";
export { Chat } from "../components/chat";
export { Message } from "../components/message";
export { ToolCall } from "../components/tool-call";
export { ActivityPanel } from "../components/activity-panel";
export { ActivityDrawer } from "../components/activity-drawer";
export { InputBar } from "../components/input-bar";
export { ThinkingIndicator } from "../components/thinking-indicator";
export { ImagePreview } from "../components/image-preview";
export { CodeBlock } from "../components/code-block";

// ── Streaming primitive + types (for fully custom UIs) ───────────
export { readArcieStream } from "../lib/stream";
export type {
  UiMessage,
  UiToolCall,
  AgentInfo,
  ArcieStreamEvent,
  ChatRole,
  UiFile,
} from "../lib/types";
