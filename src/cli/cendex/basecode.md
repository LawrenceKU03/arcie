# Basecode Project Breakdown

## 1. Overview

**Basecode** (package name `cendex`) is a terminal-based AI assistant built on **OpenTUI**, **React**, and the **Cencori** AI platform. It provides a conversational interface for analyzing codebases, entering MCP-related commands, managing AI models, and streaming model responses directly in the terminal.

The application launches into a **Home** screen with a logo and an input bar. Typing a query (or a slash command) opens a chat session where user messages are sent to a selected model, and the response is streamed in real‑time as markdown‑formatted text. Multiple providers and toasts/dialogs handle state globally.

---

## 2. Tech Stack

| Technology | Purpose |
|------------|---------|
| **TypeScript** | Full‑type safety, strict mode |
| **Bun** | Runtime & package manager (`bun run`) |
| **React 19** | UI component system (with custom reconciler via OpenTUI) |
| **OpenTUI (`@opentui/core`, `@opentui/react`, `@opentui/keymap`)** | Terminal UI primitives, React bindings, and key handling |
| **React Router** | In‑memory navigation between screens |
| **Cencori SDK (`cencori`)** | Model listing and streaming chat completions |
| **`@opentui/spinner`** | Animated spinner for loading states |
| **`@ai-sdk/*` (in package.json)** | Optional AI harness integrations (not used in current code) |
| **Express / Axios** | Listed as dependencies (future server capabilities) |

---

## 3. Project Structure

```
src/
├── index.tsx                     # Entry point – creates CLI renderer & router
├── server/
│   ├── Models.ts                 # Cencori API integration (models, chat stream)
│   └── Tools.ts                  # Empty placeholder
├── providers/
│   ├── DialogProvider/           # Global modal/dialog system
│   │   ├── index.tsx
│   │   └── types.ts
│   ├── ModelProvider.tsx         # Global model state, session messages, streaming logic
│   └── ToastProvider.tsx         # Toast notifications
├── layouts/
│   ├── RootLayout.tsx            # Provider tree + router outlet
│   └── screens/
│       ├── Home.tsx              # Landing screen (query input + submission)
│       └── NewSession.tsx        # Chat session screen (streaming responses)
├── components/
│   ├── Header.tsx                # Logo + app title bar
│   ├── InputBar/                # Main query input, status bar, slash menu trigger
│   │   ├── index.tsx
│   │   └── border.tsx            # Custom border characters
│   ├── Menu/                     # Slash command palette
│   │   ├── index.tsx
│   │   ├── commands.tsx          # Command definitions & execution
│   │   └── types.ts
│   ├── Message/                  # Renders chat messages (user / bot / error)
│   │   └── index.tsx
│   ├── ScrollablePicker/         # Model selection dialog (searchable list)
│   │   ├── index.tsx
│   │   └── types.ts
│   ├── StatusBar/                # Bottom bar (mode, active model, context window)
│   └── utils.ts                  # Number formatting helper
├── tools/
│   ├── fileHandler.ts            # File system operations (scan, read, write, search)
│   └── harness-plugin-core.ts    # Builds prompt with repo context & streams from model
└── theme.ts                      # Central color/theme definitions
```

---

## 4. Core Concepts & Responsibilities

### 4.1 Entry Point (`src/index.tsx`)
- Creates a **memory router** with two routes:
  - `/` → `Home`
  - `/new-session` → `NewSession`
- Both are nested under the `RootLayout`.
- Instantiates a CLI renderer (`createCliRenderer`) with `exitOnCtrlC: false` so that the keymap can handle `q` to quit.
- Exports a `keymap` object (default OpenTUI bindings) that is used by `RootLayout`.

### 4.2 Root Layout (`src/layouts/RootLayout.tsx`)
Wraps the app in the following provider hierarchy:

```
KeymapProvider
  └── ModelProvider
       └── ToastProvider
            └── DialogProvider
                 └── <Outlet/>
```

This ensures all nested screens have access to:
- Global key bindings (`KeymapProvider`)
- Model list / active model / session messages (`ModelProvider`)
- Toast notifications (`ToastProvider`)
- Modal dialogs (`DialogProvider`)

### 4.3 Home Screen (`Home.tsx`)
- Displays `Header` and `InputBar`.
- On submit (via `InputBar`’s `action` callback), navigates to `/new-session` with the query as route state.
- If no active model is selected, it shows an error toast.
- Clears session messages when the screen mounts (ensures a fresh start).

### 4.4 NewSession Screen (`NewSession.tsx`)
- Responsible for rendering the chat conversation and handling user input.
- On mount, if a query was passed via route state, adds it as the first user message.
- Renders all `sessionMessages` as `Message` components.
- Displays a spinner and random "thinking" word while `respLoading` is true.
- The `scrollbox` is sticky to the bottom so new messages auto‑scroll.

### 4.5 ModelProvider (`ModelProvider.tsx`)
The central state management:
- **Models**: `fetchSupportedModels()` loads available models from Cencori.
- **Active model**: persisted to `.ACTIVE_AGENT.json` (via `readFromFile` on startup).
- **Session messages**: a list of `MessageType` objects (user/bot/error).
- **Streaming logic**:
  - When a new user message is appended, `getModelResp` is called automatically (guarded by `agentResponded` ref to prevent duplicate calls).
  - It adds an empty bot placeholder, then streams chunks from either:
    - `runLocalMemoryAgentWithRepoContext` (plan mode – uses repo context), or
    - `queryModelStream` (normal chat).
  - Updates the placeholder with accumulated text as chunks arrive.
  - If the response is empty, marks the message as an error.
- Supports plan mode (`isPlanMode`) – currently always `true`, which forces the repo‑context agent path.

*Note:* The dependency array of `getModelResp` includes `interruptedStatusRef.current`, which is a ref and should not be there; this may cause stale closures or re‑runs.

### 4.6 ToastProvider
- Provides a `show(message, type?)` method.
- Displays a toast box in the top‑right corner for 3 seconds (configurable via theme).
- Types (`success`, `error`, `notification`) control border colors.

### 4.7 DialogProvider
- Manages a modal overlay (z-index 4) covering the entire terminal.
- `setDialog(payload)` opens / closes a dialog.
- The dialog has a title, optional children (custom content), and a footer hint.
- Key `q` closes the active dialog (when `currentDialog !== null`).

### 4.8 InputBar (`InputBar/index.tsx`)
- Main query input with a **textarea**.
- Placeholder text changes every 3 seconds (`shufflePlaceHolderText`).
- Keybindings:
  - `q` → quits the application (`renderer.destroy()`)
  - `ctrl+space` → triggers “interrupt” (sets `interrupted` in ModelProvider if input is empty)
  - `Enter` → submits the current text (unless a menu/dialog is open)
- If the input starts with `/`, a **slash-menu** is shown (`Menu` component) to select a command.

### 4.9 Menu (`Menu/index.tsx` + `commands.tsx`)
- Displays filtered commands (from a large list) in a scrollable picker.
- Commands are grouped into categories: session, agent, mcp, context, tools, vcs, meta.
- Each command defines an `action` executed when selected. Many actions are stubs; a few functional ones include:
  - `/new` → navigates back to Home.
  - `/clear` → clears session context.
  - `/models` → opens a dialog with `ScrollablePicker` to switch models.
  - `/init` → triggers `runLocalMemoryAgentWithRepoContext` to generate `basecode.md` and navigates to `/new-session`.
- The menu passes contextual data (`toast`, `dialog`, `activeModel`, `navig`, etc.) to actions.

### 4.10 ScrollablePicker
- Used by `/models` command to display a searchable model list.
- Includes its own keybindings (up/down/enter) to navigate and select.
- On selection, writes the model to the `ACTIVE_MODEL` file and calls `setActiveModel`.

### 4.11 Message Component
- Renders each chat message.
- Bot messages are rendered as **markdown** (via `<markdown>` from `@opentui/core`).
- User/error messages are rendered as plain text.
- Colors/borders come from `theme.message.*`.

### 4.12 StatusBar
- Shows current mode (e.g., “PLAN MODE”), the active model name, and the model’s context window (formatted via `formatNumber`, e.g., `1M`).
- If no model is selected, shows a spinner and “Please select a model”.

### 4.13 Server Layer (`Models.ts`, `Tools.ts`)
- `Models.ts`:
  - Reads `CENCORI_API_KEY` from environment (throws if missing).
  - Exports `cencori` SDK instance.
  - `fetchSupportedModels()` → fetches list from `${baseURL}/models`.
  - `queryModelStream()` → wrapper around `cencori.ai.chatStream`, adds a system prompt if no messages.
- `Tools.ts` is empty (placeholder).

### 4.14 Tools (`fileHandler.ts`, `harness-plugin-core.ts`)
- `fileHandler.ts`:
  - File read/write helpers.
  - `scanRepository()` recursively scans a directory, excluding common build/dependency folders and binary files.
  - `searchRepository()` finds files/dirs by name.
- `harness-plugin-core.ts`:
  - Builds a **system prompt** that includes the local directory path and instructs the model to analyze the repository directly (no tool invocation).
  - `runLocalMemoryAgentWithRepoContext(taskDescription, modelId)`:
    - Searches for `basecode.md`; if found, uses its content as repository context; otherwise scans the whole repo and constructs a formatted context.
    - Calls `cencori.ai.chatStream` with the user task and returns the stream.

---

## 5. End-to-End Data Flow

1. **Startup**: `index.tsx` creates renderer + router. `RootLayout` mounts providers. `ModelProvider` loads models and reads `.ACTIVE_AGENT.json`.
2. **User input**: On `Home`, `InputBar` submits → `Home.action` → `navig("/new-session", { state: { query } })`.
3. **NewSession mount**: `useLocation().state.query` added to `sessionMessages` as a user message.
4. **ModelProvider effect**: `sessionMessages` changes → `getModelResp()` is called.
5. **Streaming**: A bot placeholder is appended; the response stream updates the placeholder incrementally until complete.
6. **Rendering**: `Message` turns bot messages into markdown; `NewSession` scrolls to bottom.
7. **Interruptions**: `ctrl+space` sets `interrupted` → stream aborts (checks `interruptedStatusRef`) and shows a toast.
8. **Commands**: Typing `/` opens the menu; selecting `/models`, `/clear`, `/init`, etc. executes the corresponding action.

---

## 6. Potential Issues / Observations

- `interruptedStatusRef.current` is used in the dependency array of `getModelResp` – refs shouldn’t be dependencies.
- `agentResponded` ref uses a 2‑second timeout; it may block legitimate rapid consecutive user submissions.
- In `NewSession`, `setSessionMessages` uses `sessionMessages.length + 1` as ID – this is fine as long as messages are never deleted.
- The `command` for `/init` passes an extra argument to `mutateSessionMessages` (which is a single-argument function in the type) – TypeScript may flag it.
- `ScrollablePicker` uses `model.name || model.id` for display; if `name` is missing, it still works.
- `StatusBar` accepts a `model` prop but never uses it (the prop is removed in commit diff but still present in source).
- `src/server/Tools.ts` is just `i;` – a syntax error; should be removed or implemented.
- The plan is always enforced (no UI to toggle `isPlanMode`), so all queries currently go through the repo-context pipeline.

---

## 7. How to Run

```bash
bun install
bun run start   # starts with watch mode
```

Requires a `.env.local` with:
```env
CENCORI_API_KEY=...
CENCORI_BASE_URL=...
ACTIVE_MODEL=.ACTIVE_AGENT.json
```

---

## 8. Summary

`basecode` is a well-structured TUI chat application that integrates with the Cencori API to provide an interactive coding assistant in the terminal. Its modular provider hierarchy, router-based screens, and streaming chat logic make it easy to extend with new commands, models, or MCP features. The main logic lives in `ModelProvider`, while `InputBar` and `Menu` handle user interactions. The foundation is solid, though a few minor type/logic issues remain to be cleaned up.