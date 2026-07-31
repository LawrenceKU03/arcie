import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  loadArcieJson,
  loadArcieConfig,
  findArcieJson,
  pickAgentDir,
  missingEnvVars,
  type LoadedArcieConfig,
} from "../src/config/arcie-json";

let root: string;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "arcie-config-"));
  savedEnv = { ...process.env };
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key];
  }
  Object.assign(process.env, savedEnv);
});

function writeConfig(contents: string, name = "arcie.json"): string {
  const path = join(root, name);
  writeFileSync(path, contents);
  return path;
}

const VALID = `{
  "$schema": "https://arcie.dev/schema/arcie.json",
  "framework": "arcie",
  "version": 1,
  "agent": { "dir": "./agent", "entry": "./agent/agent.ts" },
  "runtime": {
    "buildCommand": "arcie build",
    "artifact": "./.arcie/server.mjs",
    "startCommand": "node ./.arcie/server.mjs",
    "env": ["CENCORI_API_KEY", "TAVILY_API_KEY"]
  }
}`;

describe("loadArcieJson", () => {
  it("returns null when arcie.json does not exist", () => {
    expect(loadArcieJson(root)).toBeNull();
  });

  it("loads and resolves a valid config with absolute paths", () => {
    writeConfig(VALID);
    const config = loadArcieJson(root);

    expect(config).not.toBeNull();
    expect(config!.agentDir).toBe(join(root, "agent"));
    expect(config!.agentEntry).toBe(join(root, "agent", "agent.ts"));
    expect(config!.env).toEqual(["CENCORI_API_KEY", "TAVILY_API_KEY"]);
    expect(config!.buildCommand).toBe("arcie build");
    expect(config!.artifact).toBe("./.arcie/server.mjs");
    expect(config!.startCommand).toBe("node ./.arcie/server.mjs");
    expect(config!.warnings).toEqual([]);
  });

  it("fills runtime defaults for a bare config", () => {
    writeConfig('{ "agent": { "dir": "./agent" } }');
    const config = loadArcieJson(root)!;

    expect(config.agentDir).toBe(join(root, "agent"));
    expect(config.agentEntry).toBe(join(root, "agent", "agent.ts"));
    expect(config.env).toEqual([]);
    expect(config.buildCommand).toBe("arcie build");
    expect(config.artifact).toBe("./.arcie/server.mjs");
    expect(config.startCommand).toBe("node ./.arcie/server.mjs");
  });

  it("passes declared contract routes through, leaving others undefined", () => {
    writeConfig('{ "runtime": { "contract": { "health": "GET /healthz" } } }');
    const { contract } = loadArcieJson(root)!;
    expect(contract.health).toBe("GET /healthz");
    expect(contract.invoke).toBeUndefined();
    expect(contract.channel).toBeUndefined();
  });

  it("rejects invalid JSON", () => {
    writeConfig("not json");
    expect(() => loadArcieJson(root)).toThrow(/not valid JSON/);
  });

  it("rejects a foreign framework", () => {
    writeConfig('{ "framework": "nextjs" }');
    expect(() => loadArcieJson(root)).toThrow(/framework must be "arcie"/);
  });

  it("rejects an unknown version", () => {
    writeConfig('{ "framework": "arcie", "version": 2 }');
    expect(() => loadArcieJson(root)).toThrow(/version must be 1/);
  });

  it("rejects a non-string env list", () => {
    writeConfig('{ "runtime": { "env": ["CENCORI_API_KEY", 42] } }');
    expect(() => loadArcieJson(root)).toThrow(/runtime.env must be an array of strings/);
  });

  it("warns on the legacy apps/deploy schema", () => {
    writeConfig('{ "apps": { "web": {} }, "deploy": { "default": "web" } }');
    const config = loadArcieJson(root)!;
    expect(config.warnings).toHaveLength(1);
    expect(config.warnings[0]).toMatch(/legacy "apps"\/"deploy" schema/);
  });
});

describe("findArcieJson", () => {
  it("walks up from a nested directory", () => {
    writeConfig(VALID);
    const nested = join(root, "a", "b", "c");
    mkdirSync(nested, { recursive: true });
    expect(findArcieJson(nested)).toBe(join(root, "arcie.json"));
    expect(findArcieJson(root)).toBe(join(root, "arcie.json"));
  });

  it("returns null when no config exists above", () => {
    expect(findArcieJson(join(root, "a"))).toBeNull();
  });
});

describe("loadArcieConfig", () => {
  it("locates and loads the nearest arcie.json from any cwd", () => {
    writeConfig(VALID);
    const config = loadArcieConfig(join(root, "agent", "tools"));
    expect(config?.agentDir).toBe(join(root, "agent"));
  });

  it("returns null when no project config exists", () => {
    expect(loadArcieConfig(root)).toBeNull();
  });
});

describe("pickAgentDir", () => {
  const config = (): LoadedArcieConfig => ({ agentDir: join(root, "from-config") }) as LoadedArcieConfig;

  it("prefers the explicit flag over the config", () => {
    expect(pickAgentDir(root, "explicit", config())).toBe(join(root, "explicit"));
  });

  it("falls back to the config's agent.dir", () => {
    expect(pickAgentDir(root, undefined, config())).toBe(join(root, "from-config"));
  });

  it("falls back to ./agent with no config", () => {
    expect(pickAgentDir(root, undefined, null)).toBe(join(root, "agent"));
  });
});

describe("missingEnvVars", () => {
  it("reports only the runtime env vars absent from process.env", () => {
    process.env.CENCORI_API_KEY = "sk-test";
    const config = { env: ["CENCORI_API_KEY", "TAVILY_API_KEY"] } as LoadedArcieConfig;
    expect(missingEnvVars(config)).toEqual(["TAVILY_API_KEY"]);
  });

  it("uses the legacy CENCORI_API_KEY fallback for config-less projects", () => {
    expect(missingEnvVars(null)).toEqual(["CENCORI_API_KEY"]);
  });
});
