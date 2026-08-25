import { describe, it, expect, vi } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAgent } from "../src/loader";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, "fixtures/agent");
const BROKEN_FIXTURE = resolve(__dirname, "fixtures/agent-broken");

describe("loadAgent", () => {
  it("loads config, instructions, and tool modules into a manifest", async () => {
    const { manifest, agentDir } = await loadAgent(FIXTURE);

    expect(agentDir).toBe(FIXTURE);
    expect(manifest.config.model).toBe("claude-sonnet-4-5");
    expect(manifest.config.name).toBe("fixture-agent");
    expect(manifest.instructions).toMatch(/fixture agent/i);

    expect(Object.keys(manifest.tools).sort()).toEqual(["add", "echo"]);
  });

  it("keeps the loaded tools executable", async () => {
    const { manifest } = await loadAgent(FIXTURE);
    expect(await manifest.tools.echo.execute({ ping: true })).toEqual({ ping: true });
    expect(await manifest.tools.add.execute({ a: 4, b: 5 } as any)).toEqual({ sum: 9 });
  });

  it("throws when the agent directory does not exist", async () => {
    await expect(loadAgent("definitely/not/here")).rejects.toThrow(/not found/);
  });

  it("warns and skips a broken slot file by default instead of silently dropping it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { manifest } = await loadAgent(BROKEN_FIXTURE);
      expect(manifest.tools.good).toBeDefined();
      expect(manifest.tools.broken).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("tools/broken.ts"),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("fails the load in strict mode when a slot file cannot be imported", async () => {
    await expect(loadAgent(BROKEN_FIXTURE, { strict: true })).rejects.toThrow(
      /tools\/broken\.ts.*this-module-does-not-exist/s,
    );
  });
});
