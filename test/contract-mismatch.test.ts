import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkContractMismatches, type ContractMismatch } from "../src/server/contract";
import { loadArcieJson, type LoadedArcieConfig } from "../src/config/arcie-json";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "arcie-contract-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function configWithContract(contract: unknown): LoadedArcieConfig {
  const path = join(root, "arcie.json");
  writeFileSync(path, JSON.stringify({ runtime: { contract } }, null, 2));
  return loadArcieJson(root)!;
}

describe("checkContractMismatches", () => {
  it("validates a null config (no arcie.json)", () => {
    expect(checkContractMismatches(null)).toEqual([]);
  });

  it("accepts the canonical contract", () => {
    const config = configWithContract({
      health: "GET /_health",
      invoke: "POST /invoke",
      channel: "POST /channels/:name",
      schedule: "POST /schedules/:name",
      manifest: "GET /_manifest",
    });
    expect(checkContractMismatches(config)).toEqual([]);
  });

  it("accepts the /health alias for health", () => {
    const config = configWithContract({ health: "GET /health" });
    expect(checkContractMismatches(config)).toEqual([]);
  });

  it("accepts a partial contract (undeclared slots are not promises)", () => {
    const config = configWithContract({ invoke: "POST /invoke" });
    expect(checkContractMismatches(config)).toEqual([]);
  });

  it("flags a wrong invoke route", () => {
    const config = configWithContract({ invoke: "POST /chat" });
    const mismatches = checkContractMismatches(config);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({
      key: "invoke",
      declared: "POST /chat",
      supported: ["POST /invoke"],
    });
  });

  it("flags every bad slot and keeps good ones", () => {
    const config = configWithContract({
      health: "GET /healthz",
      invoke: "POST /invoke",
      manifest: "GET /m",
    });
    const mismatches = checkContractMismatches(config);
    expect(mismatches.map((m: ContractMismatch) => m.key).sort()).toEqual(["health", "manifest"]);
  });

  it("flags a wrong method on a known path", () => {
    const config = configWithContract({ manifest: "POST /_manifest" });
    expect(checkContractMismatches(config)).toHaveLength(1);
  });
});
