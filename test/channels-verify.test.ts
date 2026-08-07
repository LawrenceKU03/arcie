import { describe, it, expect, afterEach, vi } from "vitest";
import { createHmac, generateKeyPairSync, sign, createPublicKey } from "node:crypto";
import { verifySlackRequest, verifyDiscordRequest, replyToSlack, replyToDiscord } from "../src/channels/index";
import type { ChannelRequest } from "../src/types";

function slackRequest(rawBody: string, secret: string, timestamp: string): ChannelRequest {
  const basestring = `v0:${timestamp}:${rawBody}`;
  const digest = createHmac("sha256", secret).update(basestring, "utf-8").digest("hex");
  return {
    body: JSON.parse(rawBody),
    headers: {
      "x-slack-signature": `v0=${digest}`,
      "x-slack-request-timestamp": timestamp,
    },
    method: "POST",
    rawBody,
  };
}

describe("verifySlackRequest", () => {
  const secret = "test-signing-secret";
  const now = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ type: "event_callback", event: { text: "hi" } });

  it("accepts a validly signed request", () => {
    expect(verifySlackRequest(slackRequest(body, secret, String(now)), secret)).toMatchObject({ ok: true });
  });

  it("rejects a tampered body", () => {
    const request = slackRequest(body, secret, String(now));
    request.rawBody = body.replace("hi", "hack");
    const result = verifySlackRequest(request, secret);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid/i);
  });

  it("rejects a request outside the replay window", () => {
    const old = slackRequest(body, secret, String(now - 600));
    expect(verifySlackRequest(old, secret).ok).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const request = slackRequest(body, "other-secret", String(now));
    expect(verifySlackRequest(request, secret).ok).toBe(false);
  });

  it("rejects a request with missing headers", () => {
    const request = slackRequest(body, secret, String(now));
    request.headers = {};
    expect(verifySlackRequest(request, secret).ok).toBe(false);
  });

  it("skips verification when no secret is configured", () => {
    expect(verifySlackRequest(slackRequest(body, secret, String(now)), undefined)).toMatchObject({
      ok: true,
      skipped: expect.stringContaining("SLACK_SIGNING_SECRET"),
    });
  });
});

describe("verifyDiscordRequest", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const spkiDer = publicKey.export({ format: "der", type: "spki" });
  const publicKeyHex = spkiDer.subarray(12).toString("hex");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawBody = JSON.stringify({ type: 2, data: { name: "ask" } });

  function discordRequest(sigTimestamp: string, body: string, key: string = publicKeyHex): ChannelRequest {
    const signature = sign(null, `${sigTimestamp}${body}`, privateKey).toString("hex");
    return {
      body: JSON.parse(body),
      headers: {
        "x-signature-ed25519": signature,
        "x-signature-timestamp": sigTimestamp,
      },
      method: "POST",
      rawBody: body,
    };
  }

  it("accepts a validly signed request", () => {
    expect(verifyDiscordRequest(discordRequest(timestamp, rawBody), publicKeyHex)).toMatchObject({ ok: true });
  });

  it("rejects a tampered body", () => {
    const request = discordRequest(timestamp, rawBody);
    request.rawBody = rawBody.replace("ask", "spam");
    const result = verifyDiscordRequest(request, publicKeyHex);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid/i);
  });

  it("rejects a signature from a different key", () => {
    const { publicKey: other } = generateKeyPairSync("ed25519");
    const otherHex = other.export({ format: "der", type: "spki" }).subarray(12).toString("hex");
    expect(verifyDiscordRequest(discordRequest(timestamp, rawBody), otherHex).ok).toBe(false);
  });

  it("rejects a malformed public key", () => {
    expect(verifyDiscordRequest(discordRequest(timestamp, rawBody), "not-a-key").ok).toBe(false);
  });

  it("skips verification when no public key is configured", () => {
    expect(verifyDiscordRequest(discordRequest(timestamp, rawBody), undefined)).toMatchObject({
      ok: true,
      skipped: expect.stringContaining("DISCORD_PUBLIC_KEY"),
    });
  });
});

describe("replyToSlack", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the reply through chat.postMessage with the bot token", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await replyToSlack("C123", "hello", { token: "xoxb-test" });
    expect(result.ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://slack.com/api/chat.postMessage");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer xoxb-test");
    expect(JSON.parse(String(init.body))).toMatchObject({ channel: "C123", text: "hello" });
  });

  it("passes the thread timestamp when replying in a thread", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    await replyToSlack("C123", "reply", { token: "xoxb-test", threadTs: "1700000000.000001" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ thread_ts: "1700000000.000001" });
  });

  it("fails when no bot token is available", async () => {
    delete process.env.SLACK_BOT_TOKEN;
    const result = await replyToSlack("C123", "hello");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/SLACK_BOT_TOKEN/);
  });

  it("surfaces a Slack API error", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "not_authed" })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await replyToSlack("C123", "hello", { token: "xoxb-test" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("not_authed");
  });
});

describe("replyToDiscord", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the reply to the interaction callback", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await replyToDiscord("111", "tok", "answer");
    expect(result.ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://discord.com/api/v10/interactions/111/tok/callback");
    expect(JSON.parse(String(init.body))).toEqual({ type: 4, data: { content: "answer" } });
  });

  it("truncates replies to Discord's 2000-char limit", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await replyToDiscord("111", "tok", "x".repeat(5000));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).data.content).toHaveLength(2000);
  });
});
