# AGENTS.md — AI SaaS Framework

The map for agents working in this repository. Read this first. Where this file and a README
disagree, trust this file and the code, and fix whichever is wrong in the same change.

Last verified: 2026-10-25.

## What this is

An app that builds apps. Someone clones this repository and runs the **wizard**. Over as many
sessions as it takes, the wizard gathers what their app needs: what it does, its brand, its
accounts (Supabase, Stripe, a model provider) and the cloud it will run on. Then it copies the
**template**, writes the configuration, and starts everything. What comes out is a running
SaaS: an admin side, the app, an agent backend, payments, a database and deployment.

Three layers, and changes should keep them apart:

1. **Wizard** (`apps/wizard/`): runs on the builder's machine. It collects context and
   produces a configured copy of the template. It never ships inside the generated app.
2. **Template** (`template/`): what gets copied. Everything a generated app has must work
   from this folder alone once the root files (below) are written next to it.
3. **Agent kit** (`template/packages/agent-kit/`): the domain-free agent framework the
   template's API is built on. The same kit runs Vino Vibes and Fest Vibes; keep it free of
   anything specific to one app.

Tier 2, the marketing machine, will be an optional module the wizard adds. It is being built
in Vino Vibes first and does not exist here yet.

## Map

| Path                           | What it is                                                         | Stack                                     | State                                                               |
| ------------------------------ | ------------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------- |
| `apps/wizard/`                 | The wizard                                                         | Node                                      | Seed only: `create-new.js` asks questions, writes `app.config.json` |
| `template/apps/web/`           | Admin dashboard and the app: auth, content, chat UI, Stripe, email | Next.js 15, Supabase, Drizzle, AI SDK 4/5 | Does not type-check (423 errors); see below                         |
| `template/apps/api/`           | The app's API and its assistant                                    | Node 26, Hono, AI SDK 7, agent kit, `pg`  | Builds, tests pass, runs locally                                    |
| `template/packages/agent-kit/` | Operations → routes, OpenAPI and tools; streaming chat; spend caps | AI SDK 7, Hono, OpenTelemetry             | Copied from Fest Vibes on 2026-10-25                                |
| `template/docker-compose.yml`  | Local Postgres with pgvector                                       | Docker                                    |                                                                     |

### The web app's state

It was assembled from several starters (Vercel's AI chatbot, a Supabase starter, a SaaS
starter). The chat code was written for AI SDK 5 but `ai` 4 is installed, and some modules it
imports were never brought over. The plan is not to patch it file by file: its chat moves onto
`apps/api` (the agent kit), and the app is upgraded to current Next.js and AI SDK in its own
change. Until then `pnpm check` skips it. Do not upgrade its dependencies as a side effect of
other work; `pnpm-lock.yaml` holds its versions on purpose.

Auth is Supabase only. The web app reads the session with `auth()` / `getSession()` from
`src/lib/auth/service.ts`; the API verifies the same Supabase access token as a bearer token.

## Commands

```bash
nvm use                      # Node 26
pnpm install
pnpm db:up                   # Postgres + pgvector on 127.0.0.1:55435
pnpm --filter @ai-saas/api migrate
pnpm dev                     # API on 8787, web on 3000
pnpm check                   # Biome, then typecheck and test everything but the web app
TEST_DATABASE_URL=postgresql://app:app@127.0.0.1:55435/app pnpm --filter @ai-saas/api test
pnpm wizard                  # today: writes template/apps/web/app.config.json
```

Without `TEST_DATABASE_URL` the API's database tests skip.

## How the template becomes an app

The template has no root `package.json` of its own while it lives here; this repository's
workspace includes `template/apps/*` and `template/packages/*` so it can be developed in
place. When the wizard copies `template/` out, it writes the root files the copy needs:
`package.json`, `pnpm-workspace.yaml`, `biome.json`, `.nvmrc` and the lockfile, the same as
this repository's minus the wizard. The wizard does not do this yet.

## Adding to the template's API

- A capability is one `defineOperation` in `template/apps/api/src/operations/index.ts`: a REST
  route, an OpenAPI entry, and with `agentTool: true` a tool the assistant can call.
  `get_usage` is the example to copy.
- Prompts are Markdown under `template/apps/api/prompts/`, never strings in code.
- Schema changes are new files in `template/apps/api/migrations/`, applied in name order.
- The kit's own guide is `template/packages/agent-kit/README.md`.

## Git

- Branches: `feat/...`, `fix/...`, `chore/...`, `docs/...`.
- Commit and push only as part of work the owner asked for. Open pull requests; the owner
  merges.

## Safety

- Ask before anything that costs money or touches a real account: creating cloud resources,
  Supabase projects or Stripe products, or calling a model in a loop.
- The wizard will handle the builder's credentials. It writes secrets to their own secret
  manager (AWS Secrets Manager, GCP Secret Manager, Azure Key Vault) or to git-ignored `.env`
  files, and keeps only references to them. It never logs a secret, never commits one, and
  never sends one to a model.
