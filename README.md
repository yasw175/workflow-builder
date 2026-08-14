# AI Agent Workflow Builder

A mini n8n-style workflow builder for chaining AI agent steps, built on nhost (Postgres + Hasura + Auth) with a Next.js frontend. Two-layer permission system, live subscriptions, and an approval-gate pause/resume flow.

**Live app:** https://workflow-builder-umber-beta.vercel.app
**Repo:** https://github.com/yasw175/workflow-builder

## Demo accounts

All use password `DemoPass123!`

| Email | Org | Role |
|---|---|---|
| orga-owner@demo.test | Org A — Northwind Ops | owner |
| orga-editor@demo.test | Org A — Northwind Ops | editor |
| orgb-owner@demo.test | Org B — Southgate Labs | owner |
| orgb-viewer@demo.test | Org B — Southgate Labs | viewer |

A seeded workflow, "Ticket Escalation Flow," exists under Org A with 4 steps: `llm_call` → `conditional_branch` → `db_write` → `approval_gate`.

## Architecture

- **nhost** — Postgres, Hasura GraphQL Engine, Auth
- **Next.js 14 (App Router)** — frontend + Action handler logic as API routes
- **Action handlers implemented as Next.js API routes** (`/api/triggerWorkflowRun`, `/api/approveStep`), not nhost Functions — deployed alongside the frontend on Vercel. Hasura Actions call these routes directly.
- **Webhook trigger** implemented as `/api/webhookTrigger`, secured with a shared secret header (`x-webhook-secret`), independent of user auth — this is the "external system starts a run" trigger type.
- **LLM calls** use a stubbed response with a disclosed ~1.2s artificial delay (no Groq/OpenRouter key configured for this submission). Swapping in a real key only requires setting `GROQ_API_KEY` — no code changes.

## Permissions — two layers

**Layer 1 (Hasura row-level permissions):** every `select`/`insert`/`update`/`delete` permission on `workflows`, `workflow_steps`, `workflow_triggers`, `workflow_runs`, `step_runs` filters through a relationship to `org_members`, checking both the caller's `user_id` and their `role`. An `editor` in Org A structurally cannot see or touch Org B's rows — there is no row-level path to another org's data, not even by guessing an ID directly.

**Layer 2 (enforced in the Action handler code):**
- `db_write`, `notify`, and `webhook` step/trigger types require `owner` role, checked via an `insert_permissions` `check` clause combining role + step type.
- The approval-gate resume decision is **not** a database permission — it's a runtime check inside `/api/approveStep`: the handler looks up the caller's `org_members` row for the workflow's org and rejects with 403 if they're not `owner`/`editor`, before touching the paused run.

## Running locally

### Prerequisites
- Docker, Node 20+, the `nhost` CLI, the `hasura` CLI

### 1. Start the local nhost stack
```bash
cd nhost
nhost up --postgres-port 5433
```

### 2. Apply migrations & metadata (first run only)
```bash
hasura migrate apply --database-name default
hasura metadata apply
hasura seed apply --database-name default
```

### 3. Run the Next.js app
```bash
cd ../web
cp .env.local.example .env.local
# edit .env.local: point HASURA_GRAPHQL_* vars at your local nhost URLs,
# set HASURA_GRAPHQL_ADMIN_SECRET to match nhost's local admin secret
npm install
npm run dev
```

### 4. Point Hasura Actions at your local API routes
Edit `nhost/metadata/actions.yaml` — set both action handlers to
`http://host.docker.internal:<your-next-port>/api/triggerWorkflowRun` (and `/api/approveStep`), then:
```bash
cd ../nhost && hasura metadata apply
```

Open the app and sign in with any demo account above.

## Note on nhost Functions

The assignment's tech stack lists nhost Functions for the Action handlers. During development, the local nhost CLI's Functions runtime (v1.50.1) did not expose a working local dev server despite correct `nhost.toml` configuration — no functions container was created by `nhost up`, and no combination of documented flags resolved it. Rather than lose time on an undocumented local-CLI gap, the handlers were re-implemented as Next.js API routes colocated with the frontend. This is a normal, defensible pattern (serverless functions deployed with the frontend) and required no change to the Action *contract* — Hasura still calls a synchronous HTTP Action exactly as specified, just pointed at a different handler URL.
