# Arcie UI Standard — How to build with Arcie

> **Status:** v0. `arcie/ui` kit + `useChat` shipped 2026-07-29 (React external, optional peer; `arcie/ui` + `arcie/ui/styles.css` subpaths). Remaining hooks + directory conventions tracked in §12.
> **One line:** Arcie is a **full-stack agent framework**. You learn *Arcie* — the agent (tools, policies, model via the Cencori gateway) **and** the frontend — one idiom, one toolchain. Not "an agent backend + your choice of framework."

---

## 1. What this is

Arcie ships its own **UI standard**: a React-based component kit + hooks + directory conventions + theming that you write the Arcie way — the same way you learn Next.js or SvelteKit, not by wiring Vite/Next/TanStack yourself. **Substrate decision (locked): React under the hood, the Arcie standard on top.** Familiar to millions of devs, huge ecosystem, fastest adoption — but the thing you *learn and write* is Arcie's, and Arcie owns the build.

The `<agent-chat>` web component (already in `web/src/`, shipped as `arcie/web`) is the **seed**: the same React components power both the embeddable widget and the full Arcie UI.

## 2. Principles

1. **You learn Arcie, not a stack.** One idiom for agent + UI. No framework-mixing — Arcie *is* the framework.
2. **One toolchain.** `arcie build` compiles the UI to **static assets**; the developer never touches a bundler, `next.config`, or `vite.config`.
3. **Static output.** The UI is a build artifact, not a running server — which is what keeps the deployed *runtime* a clean, headless RC container (see Cencori `COMPUTE_ARCHITECTURE.md` §4.1). SSR is a later, bigger option.
4. **Works both ways.** Default UI works instantly → customize deeply in the Arcie idiom → or delete it. Always Arcie.

## 3. Project shape

`arcie init` scaffolds:

```
my-agent/
  agent/                 # the runtime — tools, policies, config, model
    agent.ts             # model (via Cencori gateway) + config
    instructions.md
    tools/  channels/  schedules/  ...
  ui/                    # the frontend — Arcie UI standard (optional, prewired)
    app.tsx              # root component you customize (default: <AgentChat />)
    theme.ts             # theme tokens
    components/          # your own components
  arcie.json
```

- **No `ui/`** → Cencori serves the default `<agent-chat>` host page. Zero config.
- **`ui/app.tsx` present** → Arcie builds it to static and serves it at `<hostname>.cencori.app`.

Default `ui/app.tsx`:
```tsx
import { AgentChat } from "arcie/ui";
export default function App() {
  return <AgentChat />;   // talks to this agent's /invoke automatically
}
```

## 4. The component kit (`arcie/ui`) — **shipped**

Composable React components — the surface you learn. `<AgentChat>` is the batteries-included whole; the primitives let you rebuild it your way. Import the components and the one stylesheet:

```tsx
import { AgentChat, Chat, useChat } from "arcie/ui";
import "arcie/ui/styles.css";   // the compiled kit theme (~38 KB, tree-shaken)
```

React and React-DOM are **optional peer dependencies** — installing the base `arcie` runtime doesn't pull them; you add them when you use the UI.

| Export | Purpose |
|---|---|
| `<AgentChat>` | The full chat surface, zero-config default. Talks to this agent's `/invoke` automatically. |
| `<Chat>` | The chat surface with an agent switcher (`endpoint`, `agentsEndpoint`). |
| `<Message>` | One conversation turn (with copy / regenerate / approve / deny). |
| `<ToolCall>` | A tool (or subagent) call: name, args, status (`running`/`done`/`error`/`approval`/`denied`), output. |
| `<ActivityPanel>` / `<ActivityDrawer>` | The "watch it work" timeline (steps, files, sources, memory). |
| `<ThinkingIndicator>` | Reasoning/level indicator. |
| `<InputBar>` | Composer (text, attachments, mic, send/stop/clear). |
| `<ImagePreview>` / `<CodeBlock>` | Content rendering. |
| `readArcieStream(response)` | The raw NDJSON event iterator, for fully custom UIs. |

These were ported from the retired Next template and live in `web/src/components/`; this standard promotes them from "internal to the `<agent-chat>` widget" to the public `arcie/ui` kit. Types (`UiMessage`, `UiToolCall`, `ArcieStreamEvent`, `AgentInfo`, `ChatRole`, `UiFile`) ship alongside.

## 5. The hooks (the API you write against)

**`useChat` is the headless core and is shipped.** It drives one conversation against the Runtime Contract's `/invoke`, consumes the Arcie NDJSON event stream (message deltas, tool calls, subagents, activity, failures), and reduces it to messages — no DOM, no styling. Every component is built on it, so "go crazy" = compose your own UI over the same hook.

```ts
const { messages, send, stop, clear, isStreaming, sessionId } =
  useChat({ endpoint?: "/invoke", agentId?, headers? });
```

- `messages: UiMessage[]` — each assistant message carries its own `toolCalls`, `streaming`, `errored`, `latencyMs`.
- `send(input)` POSTs `{ input, sessionId?, agentId? }`; `stop()` aborts the in-flight turn; `clear()` resets messages + session.

| Hook | Status | Returns |
|---|---|---|
| `useChat()` | ✅ shipped | `{ messages, send, stop, clear, isStreaming, sessionId }` |
| `useAgent()` | planned | `{ id, name, model, status, endpoint }` — the agent context. |
| `useSession()` | planned | `{ sessionId, reset, history }` — session lifecycle. |
| `useMemory()` | planned | `{ get, set, search }` — agent memory via the Cencori gateway memory. |

## 6. Model & config — via the Cencori gateway

The **model is set in `agent/agent.ts`** (the agent config), routed through the Cencori gateway with the injected `CENCORI_API_KEY`. The UI **reads** it (`useAgent().model`) and talks to the agent's `/invoke`; it doesn't pick providers. (An agent may opt into a UI model-picker later — out of scope for v0.) This keeps model routing, spend caps, and policy on the gateway, where they belong — the UI never holds a provider key.

## 7. Theming

`ui/theme.ts` exports tokens (colors, radius, typography, light/dark); `<AgentProvider theme={…}>` applies them via CSS variables. In embed mode (`<agent-chat>`), the same tokens are injected into the shadow root (already done for the web component). Full restyle without ejecting components.

## 8. The three modes (the "works both ways")

1. **Zero-config** — no `ui/`; default `<agent-chat>`.
2. **Customize** — `ui/app.tsx` composes `arcie/ui` components + a theme; drop in your own components.
3. **Go crazy** — a fully custom UI built on the hooks (`useChat`, `useMemory`, …) and primitives, any layout you want — still Arcie, still one build.

## 9. Build, dev, embed

- **`arcie dev`** — serves the Arcie UI (HMR) + all 5 RC routes on one port. Instant local test, no external framework. *(Already rewritten to one port, no Next.js.)*
- **`arcie build`** — compiles `agent/` → `.arcie/server.mjs` (RC runtime) **and** `ui/` → static assets. One command, two outputs.
- **Embed** — the same components build to the `<agent-chat>` web component (`arcie/web`) for use in any host (React, Vue, plain HTML, the Cencori dashboard).

Under the hood the static build uses esbuild/Vite — **hidden**; the developer only knows `arcie dev` / `arcie build`.

## 10. Relationship to Cencori Compute

On `arcie deploy`, Cencori's pipeline serves the static UI on `<hostname>.cencori.app` and proxies `/invoke` (+ `/channels`) to the headless RC container — same-origin, zero CORS, per-agent isolation. The UI standard is what makes "deploy with your frontend" work without a second running framework. (See `cencori/COMPUTE_ARCHITECTURE.md` §4.1, §8.1.)

## 11. Open decisions

1. **Routing** — v0 is a **single chat surface** (`ui/app.tsx`). Multi-page Arcie apps (a `ui/pages/` or file-router convention) are a later addition. *(Recommend single-surface for v0.)*
2. **Bundler** — Vite vs esbuild for the hidden static build. (Vite for DX/HMR + ecosystem; esbuild for speed/simplicity. Leaning Vite for the dev server, esbuild-style output.)
3. **Non-React escape hatch** — do we ever expose the raw hooks for Vue/Svelte, or is React the standard, full stop? (v0: React is the standard.)
4. **Package layout** — `arcie/ui` (React kit + hooks) vs a separate `@arcie/ui` package. (Subpath `arcie/ui` keeps it one install.)
5. **SSR** — deferred (needs a second runtime; static/SPA only for v0).

## 12. Build order (Track B)

1. ✅ Promote `web/src/components/` → the public **`arcie/ui`** kit (stable component API + `arcie/ui/styles.css`). *(Shipped 2026-07-29.)*
2. ✅ Ship **`useChat`** — the headless core. *(Shipped 2026-07-29.)* Remaining hooks (`useAgent`/`useSession`/`useMemory`) next.
3. **Directory convention** (`ui/app.tsx` + `theme.ts`) + `arcie init` scaffolds a default `ui/`.
4. **`arcie build`** compiles `ui/` → static (the Track A pipeline serves it).
5. **"How to build with Arcie" user docs** — turn this spec into the public guide.

### Build wiring (as shipped)

- `arcie/ui` builds via `tsup.ui.config.ts` (browser platform, ESM, React/React-DOM external) using a dedicated **`tsconfig.ui.json`** (DOM libs, `jsx: react-jsx`, `rootDir: web/src`).
- `scripts/build-ui-css.mjs` compiles `web/src/styles.css` → `dist/ui/styles.css` with the existing Tailwind theme (`web/tailwind.config.cjs`, which scans all of `web/src`).
- `npm run build:ui` runs both; it's chained into `npm run build` after the node and `<agent-chat>` widget builds.
- `package.json`: `./ui` + `./ui/styles.css` exports; React/React-DOM as **optional** peer deps.
