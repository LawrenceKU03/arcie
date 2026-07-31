import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { loadAgent } from "../loader";
import { discoverAgent } from "../discover/index";
import { buildAgentManifest } from "../server/manifest";
import { grey, dimmed } from "./style";

/**
 * The generated server entry the deployable bundle runs. It boots the Runtime
 * Contract server for the agent that ships alongside it. `ARCIE_AGENT_DIR`
 * (injected by the Cencori runtime) overrides the default of `<bundle>/../agent`.
 */
const SERVER_ENTRY = `import { startContractServer } from "arcie/server/contract";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const bundleDir = dirname(fileURLToPath(import.meta.url));
const agentDir = process.env.ARCIE_AGENT_DIR
  ? resolve(process.cwd(), process.env.ARCIE_AGENT_DIR)
  : resolve(bundleDir, "..", "agent");

startContractServer({ agentDir, hotReload: false })
  .then(({ port }) => {
    console.log("[arcie] runtime contract server listening on :" + port);
  })
  .catch((err) => {
    console.error("[arcie] failed to start runtime:", err);
    process.exit(1);
  });
`;

/**
 * esbuild-bundles the generated server entry (with Arcie's runtime + contract
 * server inlined) into a single runnable `server.mjs`. Returns the output path
 * on success, or null when the artifact could not be produced (e.g. esbuild
 * unavailable or `arcie` not resolvable from the project) — a manifest-only
 * build still succeeds in that case.
 */
async function bundleServer(projectRoot: string, outDir: string): Promise<string | null> {
  let esbuild: typeof import("esbuild");
  try {
    esbuild = await import("esbuild");
  } catch {
    return null;
  }

  const outfile = join(outDir, "server.mjs");

  // `@libsql/client` is a native addon pulled in eagerly by the memory barrel,
  // but it is only actually needed when an agent uses SqliteStore. Stub it so
  // the bundle is fully self-contained and boots with zero external deps; the
  // stub lazily `require`s the real package at call time when it is installed.
  const libsqlStub: import("esbuild").Plugin = {
    name: "arcie-libsql-stub",
    setup(build) {
      build.onResolve({ filter: /^@libsql\/client$/ }, () => ({
        path: "@libsql/client",
        namespace: "arcie-libsql-stub",
      }));
      build.onLoad({ filter: /.*/, namespace: "arcie-libsql-stub" }, () => ({
        contents: `export function createClient(...args) {
  try { return require("@libsql/client").createClient(...args); }
  catch { throw new Error("SqliteStore requires @libsql/client — install it in your agent, or use FileStore / Cencori memory instead."); }
}`,
        loader: "js",
      }));
    },
  };

  try {
    await esbuild.build({
      stdin: {
        contents: SERVER_ENTRY,
        resolveDir: projectRoot,
        sourcefile: "arcie-server-entry.mjs",
        loader: "js",
      },
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node18",
      outfile,
      plugins: [libsqlStub],
      // Some transitive deps use CJS `require`; shim it for the ESM output.
      banner: {
        js: "import { createRequire as ___createRequire } from 'node:module';\nconst require = ___createRequire(import.meta.url);",
      },
      logLevel: "silent",
    });
    return outfile;
  } catch {
    return null;
  }
}

export async function buildCommand(options: {
  agentDir: string;
  outDir: string;
}): Promise<void> {
  const agentDirPath = resolve(process.cwd(), options.agentDir);
  const outDir = resolve(process.cwd(), options.outDir);
  const projectRoot = dirname(agentDirPath);

  console.log(`\n  Building agent...\n`);

  if (!existsSync(agentDirPath)) {
    console.error(`  Agent directory not found: ${agentDirPath}`);
    process.exit(1);
  }

  const { agent: discovered, diagnostics } = discoverAgent(agentDirPath);

  if (diagnostics.some((d) => d.severity === "error")) {
    for (const d of diagnostics) {
      console.error(`  ${grey("✖")} ${d.code}: ${d.message}`);
    }
    process.exit(1);
  }

  try {
    const agent = await loadAgent(agentDirPath);

    mkdirSync(outDir, { recursive: true });

    const manifest = buildAgentManifest(agent, discovered);
    writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    console.log(`  Written to ${dimmed(`${outDir}/manifest.json`)}`);
    console.log(`  ${grey(`\xB7 ${manifest.tools.length} tools`)}`);
    console.log(`  ${grey(`\xB7 ${manifest.skills.length} skills`)}`);
    console.log(`  ${grey(`\xB7 ${manifest.channels.length} channels`)}`);
    console.log(`  ${grey(`\xB7 ${manifest.connections.length} connections`)}`);
    console.log(`  ${grey(`\xB7 ${manifest.schedules.length} schedules`)}`);
    console.log(`  ${grey(`\xB7 ${Object.keys(manifest.subagents).length} subagents`)}`);
    console.log();

    // Emit the runnable Runtime Contract artifact the Cencori pipeline
    // containerizes: `node .arcie/server.mjs` boots the agent on $PORT.
    const serverPath = await bundleServer(projectRoot, outDir);
    if (serverPath) {
      console.log(`  Bundled runtime to ${dimmed(`${outDir}/server.mjs`)}`);
      console.log(`  ${grey("\xB7 run: ")}${dimmed("PORT=8080 node " + join(options.outDir, "server.mjs"))}`);
    } else {
      console.log(`  ${grey("⚠ could not bundle server.mjs (esbuild unavailable or 'arcie' unresolved) — manifest written")}`);
    }
    console.log();

    console.log(`  ${grey("─".repeat(50))}`);
    console.log(`  ${grey("Build complete.")}`);
    console.log();
  } catch (err) {
    console.error(`  Build failed:`, err);
    process.exit(1);
  }
}
