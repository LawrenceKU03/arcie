import type { LoadedAgent } from "../loader";
import type { DiscoveredAgent } from "../discover/index";
import type { LoadedArcieConfig } from "../config/arcie-json";

/**
 * The built agent manifest — the JSON description of an agent's capabilities
 * that `arcie build` writes to disk and the Runtime Contract's `/_manifest`
 * route serves. Shared so both paths always emit the exact same shape.
 */
export interface BuiltManifest {
  config: LoadedAgent["manifest"]["config"];
  instructions: string;
  tools: string[];
  skills: string[];
  hooks: string[];
  channels: string[];
  connections: string[];
  schedules: string[];
  subagents: Record<string, { description?: string; tools: string[] }>;
  discovered?: {
    tools: string[];
    skills: string[];
    hooks: string[];
    channels: string[];
    connections: string[];
    schedules: string[];
    subagents: string[];
  };
  session: LoadedAgent["manifest"]["session"];
  policy: LoadedAgent["manifest"]["policy"];
  /**
   * Deploy metadata for the Cencori pipeline — how to build, boot, and
   * provision this agent. Mirrors `arcie.json`'s runtime section with
   * defaults filled in, so even a bare agent directory (no arcie.json)
   * produces a fully deployable manifest.
   */
  deploy: {
    buildCommand: string;
    artifact: string;
    startCommand: string;
    /** Env vars the runtime requires — provisioned as secrets on deploy. */
    env: string[];
    /** The HTTP surface the deployed container must answer. */
    contract: {
      health: string;
      invoke: string;
      channel: string;
      schedule: string;
      manifest: string;
    };
  };
}

const DEFAULT_CONTRACT = {
  health: "GET /_health",
  invoke: "POST /invoke",
  channel: "POST /channels/:name",
  schedule: "POST /schedules/:name",
  manifest: "GET /_manifest",
} as const;

/**
 * Projects a loaded agent (and, optionally, its filesystem discovery result)
 * into the serializable manifest shape. `discovered` adds the raw
 * filesystem-slot names alongside the merged/loaded capabilities; `config`
 * supplies the deploy metadata from the project's `arcie.json` (when present).
 */
export function buildAgentManifest(
  agent: LoadedAgent,
  discovered?: DiscoveredAgent,
  config?: LoadedArcieConfig | null,
): BuiltManifest {
  const manifest: BuiltManifest = {
    config: agent.manifest.config,
    instructions: agent.manifest.instructions,
    tools: Object.keys(agent.manifest.tools),
    skills: Object.keys(agent.manifest.skills),
    hooks: Object.keys(agent.manifest.hooks),
    channels: Object.keys(agent.manifest.channels),
    connections: Object.keys(agent.manifest.connections),
    schedules: Object.keys(agent.manifest.schedules),
    subagents: Object.fromEntries(
      Object.entries(agent.manifest.subagents).map(([id, sub]) => [
        id,
        { description: sub.config.description, tools: Object.keys(sub.tools) },
      ]),
    ),
    session: agent.manifest.session,
    policy: agent.manifest.policy,
    deploy: {
      buildCommand: config?.buildCommand ?? "arcie build",
      artifact: config?.artifact ?? "./.arcie/server.mjs",
      startCommand: config?.startCommand ?? "node ./.arcie/server.mjs",
      env: config?.env ?? [],
      contract: {
        health: config?.contract.health ?? DEFAULT_CONTRACT.health,
        invoke: config?.contract.invoke ?? DEFAULT_CONTRACT.invoke,
        channel: config?.contract.channel ?? DEFAULT_CONTRACT.channel,
        schedule: config?.contract.schedule ?? DEFAULT_CONTRACT.schedule,
        manifest: config?.contract.manifest ?? DEFAULT_CONTRACT.manifest,
      },
    },
  };

  if (discovered) {
    manifest.discovered = {
      tools: discovered.tools.map((t) => t.name),
      skills: discovered.skills.map((s) => s.name),
      hooks: discovered.hooks.map((h) => h.name),
      channels: discovered.channels.map((c) => c.name),
      connections: discovered.connections.map((c) => c.name),
      schedules: discovered.schedules.map((s) => s.name),
      subagents: discovered.subagents.map((s) => s.id),
    };
  }

  return manifest;
}
