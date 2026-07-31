# Platform integration spec: arcie as a first-class deploy framework

Audience: deploy platform teams (Pxxl, Brimble, and any future partner).

Arcie is a filesystem-first AI agent framework built on the Cencori AI Gateway. An arcie project is a single Node application: an `agent/` directory holding the runtime, and an `arcie.json` at the root that declares how to build and start it. Users scaffold with `npx arcie@latest init my-agent`, develop with `arcie dev`, and deploy the artifact `arcie build` produces.

**There is no web app to deploy.** Earlier versions of arcie scaffolded a sibling Next.js `web/` app; that is gone. The chat UI now ships inside the `arcie` package as a `<agent-chat>` custom element consumed via a plain `<script>` tag, so a deployed arcie project is one process, one port, one build. If your platform previously implemented the `apps.*` / `deploy.stage` preset from an older revision of this document, replace it wholesale with the preset below.

This document specifies exactly what your platform needs to detect and deploy arcie projects. The engineering work is smaller than it used to be: arcie now emits a self-contained `server.mjs`, so the preset is close to a generic "Node app" preset.

## Detection

An imported repository should be detected as an arcie project when **any** of the following are true, in priority order:

1. **`arcie.json` exists at the repo root.** Definitive. Read the file for exact build and start settings; ignore signals 2 and 3.
2. **`arcie` appears in `package.json` dependencies.** Cheap regex check. Use the default preset below.
3. **`agent/agent.ts` exists at the repo root.** Structural fallback. Use the default preset below.

If (1) is present, it wins. If only (2) or (3), fall back to the preset defaults.

`arcie.json` carries `"framework": "arcie"` — use that field, not the presence of a `web/` directory, to identify the project type.

## `arcie.json` — the source of truth

Ships in every scaffolded arcie project. Full schema:

```json
{
  "$schema": "https://arcie.dev/schema/arcie.json",
  "framework": "arcie",
  "version": 1,

  "agent": {
    "dir": "./agent",
    "entry": "./agent/agent.ts"
  },

  "runtime": {
    "buildCommand": "arcie build",
    "artifact": "./.arcie/server.mjs",
    "startCommand": "node ./.arcie/server.mjs",
    "env": ["CENCORI_API_KEY"],
    "contract": {
      "health": "GET /_health",
      "invoke": "POST /invoke",
      "channel": "POST /channels/:name",
      "schedule": "POST /schedules/:name",
      "manifest": "GET /_manifest"
    }
  }
}
```

Field semantics:

- **`agent.dir`** — the runtime lives here. Contains `agent.ts`, `instructions.md`, `tools/`, `subagents/`, `knowledge/`, `channels/` (Slack, WhatsApp, and other non-HTTP integrations), `schedules/`, `sessions/`, and `policies/`.
- **`agent.entry`** — the agent definition module. Informational for your purposes; `arcie build` resolves it.
- **`runtime.buildCommand`** — run this at the repo root to produce the artifact.
- **`runtime.artifact`** — the file the build produces, relative to repo root. Its presence after a build is a good success check.
- **`runtime.startCommand`** — run this at the repo root to start the container.
- **`runtime.env`** — environment variables the runtime requires. Your dashboard should prompt for these on first deploy and store them as secrets.
- **`runtime.contract`** — the HTTP surface the started process answers. See [Runtime Contract](#runtime-contract) below. Treat this block as descriptive: it tells you which route to health-check and which routes are safe to expose publicly.

Older projects may still contain `apps` and `deploy` blocks instead of `runtime`. Those describe the retired Next.js layout. If you support them at all, treat `runtime` as taking precedence when both are present.

## Preset build settings

When you detect an arcie project, configure the build with these values — from `arcie.json` when present, otherwise from these defaults:

| Setting | Value |
|---|---|
| Base directory | repo root (no subdirectory) |
| Pre-build step | none |
| Install command | `npm install` at repo root |
| Build command | `arcie build` (or `npm run build`, which wraps it) |
| Build output | `./.arcie/server.mjs` and `./.arcie/manifest.json` |
| Start command | `node ./.arcie/server.mjs` (equivalently `arcie serve`) |
| Port | `$PORT`, falling back to `8080` |
| Bind | `0.0.0.0` (the server binds this by default) |
| Health check | `GET /_health` → `200 {"status":"ok"}` |
| Node version | 18 or newer |
| Required env | `CENCORI_API_KEY` (secret) |

Notes for implementers:

- **One install, one build, one process.** No base directory to set, no second `package.json`, no file-staging step. The staging hook the previous spec required (`./agent` → `./web/agent`) must be removed — it now copies a directory into a path that does not exist.
- **The artifact is self-contained.** `arcie build` uses esbuild to bundle the agent's server entry together with the arcie runtime into a single ESM file targeting Node 18. It boots with zero external dependencies, so `node_modules` is not needed at runtime and the build output can be shipped alone if your pipeline prunes.
- **`arcie build` also writes `.arcie/manifest.json`** — a JSON description of the agent's tools, skills, hooks, channels, connections, schedules, subagents, session config, and policies. You may surface this in your dashboard; it is the same shape `GET /_manifest` serves.
- **`ARCIE_AGENT_DIR`** overrides where the started process looks for the agent directory. It defaults to `<artifact dir>/../agent`, which is correct for the standard layout. Set it only if your pipeline relocates the bundle away from its sibling `agent/`.
- **Bundling is best-effort.** If esbuild is unavailable or `arcie` cannot be resolved from the project, `arcie build` still succeeds and writes `manifest.json` without `server.mjs`. Check for the artifact rather than relying on the exit code alone.

### Filesystem and statefulness

By default the runtime persists working and semantic memory to disk under `<agent.dir>/sessions/.memory`. On an ephemeral container filesystem this is harmless but non-durable — memory resets on redeploy.

If your platform's containers are strictly read-only, start with `arcie serve --no-memory` for a fully stateless runtime. If you offer persistent volumes, mounting one at `agent/sessions` gives users durable memory across deploys, which is worth exposing as an option.

## Runtime Contract

The started process answers a fixed set of routes on `$PORT`. This is the whole public surface.

| Route | Purpose |
|---|---|
| `GET /_health` | readiness — returns `200 {"status":"ok"}` as soon as the process is up (`/health` is accepted as an alias) |
| `GET /_manifest` | the built agent manifest; accepts an optional `?agentId=` query parameter |
| `POST /invoke` | run one agent turn |
| `POST /channels/:name` | deliver an inbound channel event to the named channel handler |
| `POST /schedules/:name` | fire the named schedule |

Anything else returns `404 {"error":"not found"}`.

`POST /invoke` takes a JSON body with `input` (or `message`) plus optional `sessionId`, `threadId`, and `agentId`. Response format is negotiated:

- **NDJSON** by default — one JSON event per line. This is what the bundled `<agent-chat>` widget consumes.
- **Server-Sent Events** when the caller sends `Accept: text/event-stream`.
- **A single buffered JSON reply** when the body contains `"stream": false`, returning `{ output, sessionId }`.

Two implications for your proxy layer: streaming responses must not be buffered, and `Cache-Control: no-transform` is already set — please honour it. Agent turns can run for minutes, so set request timeouts generously (300s is a reasonable floor) and keep idle-connection timeouts above your streaming timeout.

`/_health` is cheap and does not load the agent, so it is safe to poll aggressively. `/_manifest` loads the agent and is not.

## What arcie provides on our side

- **`arcie init`** ships every project with `arcie.json` at the root, `agent/agent.ts`, and a `package.json` whose only runtime dependencies are `arcie` and `zod`. Detection works from day one.
- **`arcie build` / `arcie serve`** give your pipeline a stable two-command contract that will not change shape underneath you. The route list above is versioned by `arcie.json`'s `version` field.
- **Framework picker parity.** If your platform lists frameworks in its "New Project" UI, arcie should appear alongside Next.js, Nuxt, and the rest. Logo assets and a one-line description are provided on request.
- **Planned: `arcie deploy`.** A CLI picker that launches your platform's login flow, syncs `.env.local` into your encrypted env store, and triggers a deploy without leaving the terminal. Not yet shipped — the commands available today are `init`, `dev`, `build`, `serve`, and `eval`.

## The reciprocal ask

We list your platform in arcie's deploy path. You list arcie in your framework picker. Users flowing through either surface land on both brands.

Concretely:

1. Ship the detection rules and preset above.
2. Add "arcie" to your public framework list on the marketing site and in-product picker.
3. Publish a short deploy guide: *"Deploying arcie agents on \<your platform\>"*.
4. Link back from your docs when relevant.

Arcie in exchange:

1. Ships your platform as a first-class target in the deploy flow, alongside the other partner.
2. References your platform in the arcie docs' *Deployment* section.
3. Coordinates launch: joint announcement, cross-posted on both blogs.

## Questions or ready to ship

Reach out to Roy at Cencori. Schema and logo assets available on request. Once the preset is live on your side, arcie will list you in the next patch release.
