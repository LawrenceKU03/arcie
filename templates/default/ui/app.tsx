import { AgentChat } from "arcie/ui";

/**
 * The root of your agent's frontend.
 *
 * This file is yours. Compose the `arcie/ui` kit, drop in your own components,
 * or rebuild the surface entirely on the `useChat` hook — it stays one build
 * either way. `arcie dev` serves this next to the agent on one port, and
 * `arcie build` compiles it to static assets.
 *
 * Delete the `ui/` directory to fall back to the default chat page.
 */
export default function App() {
  return <AgentChat />;
}
