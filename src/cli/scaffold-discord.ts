import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ScaffoldDiscordResult {
  readonly targetPath: string;
  readonly alreadyExisted: boolean;
}

const DISCORD_CHANNEL_TEMPLATE = `import { defineChannel, POST, runAgent, verifyDiscordRequest } from "arcie";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/*
  Discord Interactions channel — signed, replying, production-ready.

  1. Create a Discord app at https://discord.com/developers/applications
  2. Enable Interactions and set the endpoint URL to:
     https://your-domain.com/api/channels/discord/interactions
  3. Add the env vars (see .env.local):
     DISCORD_PUBLIC_KEY  — every request is ed25519-verified (401 otherwise)
     DISCORD_BOT_TOKEN   — required by the Discord API
  4. For local dev, expose the server with a tunnel (ngrok).

  Discord requires a response within 3 seconds of an interaction. Slash
  commands reply directly when the agent answers in time; for slow agents,
  return { type: 5 } to defer and then post the reply with replyToDiscord
  using payload.id and payload.token.
*/

const agentDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export default defineChannel({
  name: "discord",
  type: "discord",
  handler: POST(async (request) => {
    const verification = verifyDiscordRequest(request);
    if (!verification.ok) {
      return { status: 401, body: { error: verification.error } };
    }
    if (verification.skipped) {
      console.warn("[discord] " + verification.skipped);
    }

    const payload = request.body as Record<string, unknown>;

    // Discord PING
    if (payload.type === 1) {
      return { status: 200, body: { type: 1 } };
    }

    // Slash command
    if (payload.type === 2) {
      const data = payload.data as Record<string, unknown> | undefined;
      const commandName = data?.name as string | undefined;
      const options = data?.options as Array<{ value?: string }> | undefined;
      const input = options?.[0]?.value ?? commandName ?? "";
      const guildId = payload.guild_id as string | undefined;

      try {
        const { output } = await runAgent(agentDir, String(input), {
          resourceId: \`discord:\${guildId ?? "dm"}\`,
          sessionId: String(payload.id),
        });
        return { status: 200, body: { type: 4, data: { content: output.slice(0, 2000) } } };
      } catch (err) {
        console.error("[discord] agent run failed:", err instanceof Error ? err.message : err);
        return {
          status: 200,
          body: { type: 4, data: { content: "The agent failed to respond. Try again shortly." } },
        };
      }
    }

    // Message component interaction
    if (payload.type === 3) {
      return { status: 200, body: { type: 4, data: { content: "Received" } } };
    }

    return { status: 200, body: { type: 1 } };
  }),
});
`;

export function scaffoldDiscordChannel(agentDir: string): ScaffoldDiscordResult {
  const targetDir = join(agentDir, "channels");
  const targetFile = join(targetDir, "discord.ts");

  if (existsSync(targetFile)) {
    return { targetPath: targetFile, alreadyExisted: true };
  }

  mkdirSync(targetDir, { recursive: true });
  writeFileSync(targetFile, DISCORD_CHANNEL_TEMPLATE, "utf-8");
  return { targetPath: targetFile, alreadyExisted: false };
}
