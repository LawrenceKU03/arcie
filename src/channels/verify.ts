import {
  createHmac,
  createPublicKey,
  timingSafeEqual,
  verify,
  type KeyObject,
} from "node:crypto";
import type { ChannelRequest } from "../types";

export interface VerificationResult {
  ok: boolean;
  /** When verification could not be performed (e.g. secret not configured). */
  skipped?: string;
  error?: string;
}

const SLACK_SIGNING_VERSION = "v0";
const SLACK_MAX_CLOCK_SKEW_SECONDS = 300;
const DISCORD_SIGNATURE_HEADER = "x-signature-ed25519";
const DISCORD_TIMESTAMP_HEADER = "x-signature-timestamp";

/**
 * Verifies a Slack Events API request against the app's signing secret
 * (`SLACK_SIGNING_SECRET`). Slack signs `v0:<timestamp>:<rawBody>` with
 * HMAC-SHA256 and sends it in `X-Slack-Signature`. Also enforces the
 * request timestamp is within 5 minutes of now (replay protection).
 *
 * Returns `{ ok: true, skipped }` when no signing secret is configured —
 * local development without a secret stays frictionless, but a deployed
 * channel should always set one.
 */
export function verifySlackRequest(
  request: ChannelRequest,
  secret: string | undefined = process.env.SLACK_SIGNING_SECRET,
): VerificationResult {
  if (!secret || secret.length === 0) {
    return { ok: true, skipped: "SLACK_SIGNING_SECRET not set — signature check skipped" };
  }

  const signatureHeader = request.headers["x-slack-signature"];
  const timestamp = request.headers["x-slack-request-timestamp"];

  if (!signatureHeader || !timestamp) {
    return { ok: false, error: "missing X-Slack-Signature or X-Slack-Request-Timestamp headers" };
  }

  const now = Math.floor(Date.now() / 1000);
  const then = Number(timestamp);
  if (!Number.isFinite(then) || Math.abs(now - then) > SLACK_MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false, error: "request timestamp outside the 5-minute replay window" };
  }

  const basestring = `${SLACK_SIGNING_VERSION}:${timestamp}:${request.rawBody}`;
  const digest = createHmac("sha256", secret).update(basestring, "utf-8").digest("hex");
  const expected = Buffer.from(`${SLACK_SIGNING_VERSION}=${digest}`, "utf-8");
  const received = Buffer.from(signatureHeader, "utf-8");

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { ok: false, error: "invalid X-Slack-Signature" };
  }
  return { ok: true };
}

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function discordPublicKey(publicKeyHex: string): KeyObject | null {
  if (!/^[0-9a-fA-F]{64}$/.test(publicKeyHex)) return null;
  try {
    return createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, "hex")]),
      format: "der",
      type: "spki",
    });
  } catch {
    return null;
  }
}

/**
 * Verifies a Discord Interactions request against the app's public key
 * (`DISCORD_PUBLIC_KEY`). Discord signs `<timestamp><rawBody>` with
 * ed25519 and sends the signature in `X-Signature-Ed25519`.
 *
 * Returns `{ ok: true, skipped }` when no public key is configured.
 */
export function verifyDiscordRequest(
  request: ChannelRequest,
  publicKeyHex: string | undefined = process.env.DISCORD_PUBLIC_KEY,
): VerificationResult {
  if (!publicKeyHex || publicKeyHex.length === 0) {
    return { ok: true, skipped: "DISCORD_PUBLIC_KEY not set — signature check skipped" };
  }

  const signature = request.headers[DISCORD_SIGNATURE_HEADER];
  const timestamp = request.headers[DISCORD_TIMESTAMP_HEADER];

  if (!signature || !timestamp) {
    return { ok: false, error: "missing X-Signature-Ed25519 or X-Signature-Timestamp headers" };
  }

  const key = discordPublicKey(publicKeyHex);
  if (!key) {
    return { ok: false, error: "DISCORD_PUBLIC_KEY is not a valid ed25519 public key" };
  }

  let valid: boolean;
  try {
    valid = verify(
      null,
      Buffer.from(`${timestamp}${request.rawBody}`, "utf-8"),
      key,
      Buffer.from(signature, "hex"),
    );
  } catch {
    return { ok: false, error: "invalid signature format" };
  }
  if (!valid) {
    return { ok: false, error: "invalid ed25519 signature" };
  }
  return { ok: true };
}
