import * as React from "react";
import { readArcieStream } from "../lib/stream";
import type { UiMessage, UiToolCall } from "../lib/types";

/**
 * useChat — the core of the Arcie UI standard.
 *
 * Headless hook that drives one agent conversation against the Runtime
 * Contract's `/invoke` endpoint: it sends a turn, consumes the Arcie NDJSON
 * event stream, and reduces it into a list of messages (with tool calls).
 * No styling, no DOM — build any UI on top of it. `<AgentChat>` is built on it.
 */

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export interface UseChatOptions {
  /** URL each turn POSTs to. Defaults to the Runtime Contract's `/invoke`. */
  endpoint?: string;
  /** Optional agent id, forwarded in the request body when set. */
  agentId?: string;
  /** Extra headers merged into each request. */
  headers?: Record<string, string>;
}

export interface UseChatResult {
  messages: UiMessage[];
  /** Send a user turn and stream the assistant reply. */
  send: (input: string) => Promise<void>;
  /** Abort the in-flight turn. */
  stop: () => void;
  /** Clear the conversation and session. */
  clear: () => void;
  isStreaming: boolean;
  sessionId: string | undefined;
}

export function useChat(options: UseChatOptions = {}): UseChatResult {
  const { endpoint = "/invoke", agentId, headers } = options;

  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [isStreaming, setStreaming] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string | undefined>(undefined);
  const abortRef = React.useRef<AbortController | undefined>(undefined);
  const sessionRef = React.useRef<string | undefined>(undefined);

  const patchMessage = React.useCallback(
    (id: string, patch: (prev: UiMessage) => UiMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? patch(m) : m)));
    },
    [],
  );

  const streamInto = React.useCallback(
    async (assistantId: string, response: Response, signal: AbortSignal) => {
      const patchAssistant = (patch: (prev: UiMessage) => UiMessage) =>
        patchMessage(assistantId, patch);

      const patchToolCall = (callId: string, patch: (prev: UiToolCall) => UiToolCall) => {
        patchAssistant((m) => {
          const toolCalls = [...(m.toolCalls ?? [])];
          const idx = toolCalls.findIndex((c) => c.callId === callId);
          if (idx === -1) return m;
          toolCalls[idx] = patch(toolCalls[idx]!);
          return { ...m, toolCalls };
        });
      };

      for await (const event of readArcieStream(response)) {
        if (signal.aborted) break;
        switch (event.type) {
          case "session.started": {
            const sid = (event.data as { sessionId?: string }).sessionId;
            if (sid) {
              sessionRef.current = sid;
              setSessionId(sid);
            }
            break;
          }
          case "message.appended": {
            const delta = (event.data as { delta?: string }).delta ?? "";
            if (delta.length > 0) patchAssistant((m) => ({ ...m, content: `${m.content}${delta}` }));
            break;
          }
          case "message.completed": {
            const finished = (event.data as { text?: string | null }).text;
            patchAssistant((m) => ({
              ...m,
              content: typeof finished === "string" && finished.length > 0 ? finished : m.content,
            }));
            break;
          }
          case "reasoning.appended":
          case "reasoning.completed":
            // Internal reasoning is not stored or rendered.
            break;
          case "tool.started": {
            const data = event.data as { name: string; callId: string; input: unknown };
            patchAssistant((m) => {
              const toolCalls = m.toolCalls ?? [];
              if (toolCalls.some((c) => c.callId === data.callId)) return m;
              const call: UiToolCall = {
                callId: data.callId,
                name: data.name,
                input: data.input,
                status: "running",
                kind: "tool",
                startedAt: Date.now(),
              };
              return { ...m, toolCalls: [...toolCalls, call] };
            });
            break;
          }
          case "subagent.called": {
            const data = event.data as { callId: string };
            patchToolCall(data.callId, (c) => ({ ...c, kind: "subagent" }));
            break;
          }
          case "tool.completed": {
            const data = event.data as {
              callId: string;
              output: unknown;
              status: string;
              error?: { code: string; message: string };
            };
            const isApproval = data.status === "pending" && data.error?.code === "needs_approval";
            patchToolCall(data.callId, (c) => ({
              ...c,
              status: isApproval
                ? "approval"
                : data.status === "completed"
                  ? "done"
                  : data.status === "rejected"
                    ? "denied"
                    : "error",
              output: data.output,
              errorMessage: data.error?.message,
              completedAt: isApproval ? undefined : Date.now(),
            }));
            break;
          }
          case "step.failed":
          case "turn.failed":
          case "session.failed": {
            const data = event.data as { code?: string; message?: string };
            patchAssistant((m) => ({
              ...m,
              content: data.message ?? "Something went wrong.",
              streaming: false,
              errored: true,
            }));
            break;
          }
        }
      }
    },
    [patchMessage],
  );

  const send = React.useCallback(
    async (input: string) => {
      const trimmed = input.trim();
      if (trimmed.length === 0 || abortRef.current) return;

      const userMessage: UiMessage = { id: newId("m"), role: "user", content: trimmed };
      const assistantId = newId("m");
      const assistantMessage: UiMessage = { id: assistantId, role: "assistant", content: "", streaming: true };
      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const startedAt = Date.now();

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(headers ?? {}) },
          body: JSON.stringify({
            input: trimmed,
            ...(sessionRef.current ? { sessionId: sessionRef.current } : {}),
            ...(agentId && agentId !== "agent" ? { agentId } : {}),
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          patchMessage(assistantId, (m) => ({
            ...m,
            content: text || `Server error (${response.status})`,
            streaming: false,
            errored: true,
          }));
          return;
        }
        await streamInto(assistantId, response, controller.signal);
      } catch (error) {
        if (!controller.signal.aborted) {
          patchMessage(assistantId, (m) => ({
            ...m,
            content: error instanceof Error ? error.message : String(error),
            streaming: false,
            errored: true,
          }));
        }
      } finally {
        const latencyMs = Date.now() - startedAt;
        patchMessage(assistantId, (m) => ({ ...m, streaming: false, latencyMs }));
        setStreaming(false);
        abortRef.current = undefined;
      }
    },
    [endpoint, headers, agentId, streamInto, patchMessage],
  );

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = undefined;
    setStreaming(false);
  }, []);

  const clear = React.useCallback(() => {
    setMessages([]);
    sessionRef.current = undefined;
    setSessionId(undefined);
  }, []);

  return { messages, send, stop, clear, isStreaming, sessionId };
}
