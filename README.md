# AI SaaS Framework

An app that builds apps. Clone it, run the wizard, and tell it about the app you want. When it
has what it needs, it copies a full-stack template, configures it with your accounts, and
starts it: an admin side, the app itself, an agent backend, Stripe, a database, and deployment
to the cloud you choose.

> Status: the template's API and agent kit work; the wizard is a questionnaire; the web app is
> being upgraded. See `AGENTS.md` for exactly what works.

## Layout

```
apps/wizard/              the wizard you run
template/                 what the wizard copies
  apps/web/               Next.js: admin dashboard and the app
  apps/api/               Hono + agent kit: operations, the assistant, spend caps
  packages/agent-kit/     the agent framework the API is built on
```

## Try it

You need Node 26 (`nvm use`), pnpm 12 and Docker.

```bash
pnpm install
pnpm db:up
cp template/apps/api/.env.example template/apps/api/.env      # set SUPABASE_URL and a model key
pnpm --filter @ai-saas/api migrate
pnpm --filter @ai-saas/api dev                                  # http://localhost:8787/openapi.json
pnpm check
```

The web app's setup (Supabase tables, Stripe, email) is in `template/apps/web/README.md`.
