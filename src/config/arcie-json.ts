import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * The `arcie.json` project manifest — the single source of truth for how an
 * agent is built, booted, and provisioned. Written by `arcie init`, read by
 * `arcie build` / `arcie serve` / `arcie dev` (and, in production, by the
 * Cencori pipeline and the Runtime Contract server itself).
 *
 * ```jsonc
 * {
 *   "$schema": "https://arcie.dev/schema/arcie.json",
 *   "framework": "arcie",
 *   "version": 1,
 *   "agent": { "dir": "./agent", "entry": "./agent/agent.ts" },
 *   "runtime": {
 *     "buildCommand": "arcie build",
 *     "artifact": "./.arcie/server.mjs",
 *     "startCommand": "node ./.arcie/server.mjs",
 *     "env": ["CENCORI_API_KEY"],
 *     "contract": {
 *       "health": "GET /_health",
 *       "invoke": "POST /invoke",
 *       "channel": "POST /channels/:name",
 *       "schedule": "POST /schedules/:name",
 *       "manifest": "GET /_manifest"
 *     }
 *   }
 * }
 * ```
 */
export interface ArcieJsonSchema {
  $schema?: string;
  /** Must be "arcie" when present. */
  framework?: string;
  /** Must be 1 when present. */
  version?: number;
  agent?: {
    dir?: string;
    entry?: string;
  };
  runtime?: ArcieRuntimeConfig;
}

export interface ArcieRuntimeConfig {
  /** Command the platform runs to produce the deployable artifact. */
  buildCommand?: string;
  /** Artifact path (relative to the project root) the build produces. */
  artifact?: string;
  /** Command the platform runs to boot the agent container. */
  startCommand?: string;
  /** Environment variables the runtime requires (provisioned on deploy). */
  env?: string[];
  /** The HTTP surface the deployed container answers. */
  contract?: ArcieContractConfig;
}

export interface ArcieContractConfig {
  health?: string;
  invoke?: string;
  channel?: string;
  schedule?: string;
  manifest?: string;
}

/**
 * A validated, resolved `arcie.json` — all paths absolute, all runtime
 * defaults filled in, so consumers never deal with optionality or relative
 * paths again.
 */
export interface LoadedArcieConfig {
  /** Absolute path of the `arcie.json` file itself. */
  path: string;
  /** Absolute path of the directory holding `arcie.json`. */
  projectRoot: string;
  /** Resolved absolute agent directory (`agent.dir`). */
  agentDir: string;
  /** Resolved absolute agent entry file (`agent.entry`). */
  agentEntry: string;
  /** Declared runtime env vars (`runtime.env`). */
  env: string[];
  buildCommand: string;
  artifact: string;
  startCommand: string;
  contract: ArcieContractConfig;
  /** Non-fatal schema notices (legacy keys, etc.) — printed by CLI layers. */
  warnings: string[];
  raw: ArcieJsonSchema;
}

const DEFAULT_AGENT_DIR = "./agent";
const DEFAULT_AGENT_ENTRY = "./agent/agent.ts";
const DEFAULT_BUILD_COMMAND = "arcie build";
const DEFAULT_ARTIFACT = "./.arcie/server.mjs";
const DEFAULT_START_COMMAND = "node ./.arcie/server.mjs";

/**
 * Walks up from `startDir` (max 12 levels) looking for an `arcie.json` —
 * a project can be nested under a monorepo/workspace root, and `arcie build`
 * is often run from the agent directory or a subfolder of it.
 */
export function findArcieJson(startDir: string): string | null {
  let current = resolve(startDir);
  for (let depth = 0; depth < 12; depth += 1) {
    const candidate = join(current, "arcie.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(name: string, value: unknown, optional: boolean): string | undefined {
  if (value === undefined && optional) return undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`arcie.json: "${name}" must be a non-empty string`);
  }
  return value;
}

/**
 * Reads and validates `arcie.json` at `projectRoot`. Returns null when the
 * file does not exist; throws a descriptive error when it is malformed.
 */
export function loadArcieJson(projectRoot: string): LoadedArcieConfig | null {
  const path = join(projectRoot, "arcie.json");
  if (!existsSync(path)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(
      `arcie.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!isRecord(raw)) {
    throw new Error("arcie.json must contain a JSON object");
  }

  if (raw.framework !== undefined && raw.framework !== "arcie") {
    throw new Error(`arcie.json: framework must be "arcie", got "${String(raw.framework)}"`);
  }
  if (raw.version !== undefined && raw.version !== 1) {
    throw new Error(`arcie.json: version must be 1, got "${String(raw.version)}"`);
  }

  const agent = isRecord(raw.agent) ? raw.agent : {};
  const runtime = isRecord(raw.runtime) ? raw.runtime : {};
  const contract = isRecord(runtime.contract) ? runtime.contract : {};

  const agentDir = stringField("agent.dir", agent.dir, true) ?? DEFAULT_AGENT_DIR;
  const agentEntry = stringField("agent.entry", agent.entry, true) ?? DEFAULT_AGENT_ENTRY;

  const buildCommand = stringField("runtime.buildCommand", runtime.buildCommand, true) ??
    DEFAULT_BUILD_COMMAND;
  const artifact = stringField("runtime.artifact", runtime.artifact, true) ?? DEFAULT_ARTIFACT;
  const startCommand = stringField("runtime.startCommand", runtime.startCommand, true) ??
    DEFAULT_START_COMMAND;

  const envValue = runtime.env;
  if (envValue !== undefined && (!Array.isArray(envValue) || envValue.some((v) => typeof v !== "string"))) {
    throw new Error('arcie.json: runtime.env must be an array of strings');
  }

  // Pre-0.3.5 projects were scaffolded with an "apps"/"deploy" schema (Next.js
  // shell era). Those keys are inert now — the runtime section is the source
  // of truth — so warn instead of silently shipping default runtime config.
  const warnings: string[] = [];
  if (raw.apps !== undefined || raw.deploy !== undefined) {
    warnings.push(
      'arcie.json uses the legacy "apps"/"deploy" schema — replace it with the "runtime" section (see templates/default/arcie.json)',
    );
  }

  return {
    path,
    projectRoot: resolve(projectRoot),
    agentDir: resolve(projectRoot, agentDir),
    agentEntry: resolve(projectRoot, agentEntry),
    env: (envValue as string[] | undefined) ?? [],
    buildCommand,
    artifact,
    startCommand,
    contract: {
      health: stringField("runtime.contract.health", contract.health, true),
      invoke: stringField("runtime.contract.invoke", contract.invoke, true),
      channel: stringField("runtime.contract.channel", contract.channel, true),
      schedule: stringField("runtime.contract.schedule", contract.schedule, true),
      manifest: stringField("runtime.contract.manifest", contract.manifest, true),
    },
    warnings,
    raw: raw as ArcieJsonSchema,
  };
}

/**
 * Locates the nearest `arcie.json` (walking up from `cwd`) and loads it.
 * Returns null when no project config exists; throws on malformed config.
 */
export function loadArcieConfig(cwd: string): LoadedArcieConfig | null {
  const found = findArcieJson(cwd);
  if (!found) return null;
  return loadArcieJson(dirname(found));
}

/**
 * Resolves the effective agent directory for a command:
 * an explicit CLI `--agent-dir` wins, then `arcie.json`'s `agent.dir`,
 * then the conventional `./agent` default.
 */
export function pickAgentDir(
  cwd: string,
  explicitAgentDir: string | undefined,
  config: LoadedArcieConfig | null,
): string {
  if (explicitAgentDir) return resolve(cwd, explicitAgentDir);
  if (config) return config.agentDir;
  return resolve(cwd, DEFAULT_AGENT_DIR);
}

/**
 * The subset of `runtime.env` (or the legacy hardcoded default) not present
 * in `process.env`. Used to warn before boot so a deploy never starts with a
 * key missing.
 */
export function missingEnvVars(
  config: LoadedArcieConfig | null,
  legacyFallback: string[] = ["CENCORI_API_KEY"],
): string[] {
  const required = config && config.env.length > 0 ? config.env : legacyFallback;
  return required.filter((name) => !process.env[name]);
}
