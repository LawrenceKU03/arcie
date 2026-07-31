import { existsSync } from "node:fs";
import { startContractServer } from "../server/contract";
import { loadArcieConfig, pickAgentDir, missingEnvVars } from "../config/arcie-json";
import { grey, dimmed } from "./style";

export interface ServeOptions {
  agentDir?: string;
  port?: number;
  host?: string;
  memory?: boolean;
}

/**
 * Boots the Runtime Contract server for a built agent. This is the process a
 * deployed Arcie container runs: `arcie serve` on `$PORT`, answering
 * `/_health`, `/invoke`, `/channels/:name`, `/schedules/:name`, `/_manifest`.
 */
export async function serveCommand(options: ServeOptions): Promise<void> {
  const config = loadArcieConfig(process.cwd());
  const agentDir = pickAgentDir(process.cwd(), options.agentDir, config);

  if (!existsSync(agentDir)) {
    console.error(`  ${grey("✖")} agent directory not found: ${agentDir}`);
    process.exit(1);
  }

  // `arcie.json` runtime.env declares the keys the deployed container needs;
  // without one, CENCORI_API_KEY is the one key /invoke cannot live without.
  const missing = missingEnvVars(config);
  for (const name of missing) {
    console.warn(`  ${grey("⚠")} ${name} is not set — /invoke will fail until it is`);
  }

  const { port } = await startContractServer({
    agentDir,
    port: options.port,
    host: options.host,
    hotReload: false,
    memory: options.memory,
  });

  const host = options.host ?? "0.0.0.0";
  console.log();
  console.log(`  ${dimmed(`arcie runtime  http://${host}:${port}`)}`);
  console.log(`  ${dimmed(`agent          ${agentDir}`)}`);
  if (config) {
    console.log(`  ${dimmed(`config         ${config.path}`)}`);
    for (const warning of config.warnings) console.warn(`  ${grey("⚠")} ${warning}`);
  }
  console.log();
  console.log(`  ${dimmed("routes")}`);
  console.log(`  ${grey("\xB7")} GET  /_health`);
  console.log(`  ${grey("\xB7")} GET  /_manifest`);
  console.log(`  ${grey("\xB7")} POST /invoke`);
  console.log(`  ${grey("\xB7")} POST /channels/:name`);
  console.log(`  ${grey("\xB7")} POST /schedules/:name`);
  console.log();

  const shutdown = () => process.exit(0);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
