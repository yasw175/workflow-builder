# Write-up

## Schema reasoning

Seven tables: `organizations`, `org_members`, `workflows`, `workflow_steps`, `workflow_triggers`, `workflow_runs`, `step_runs`. `org_members` is the join table the entire permission model hinges on — it's the only place `role` lives, and every other table's permission rule reaches `org_members` through a relationship chain rather than storing role/org info redundantly. `workflow_steps.step_order` plus a unique constraint on `(workflow_id, step_order)` gives deterministic ordering without a linked-list structure. `step_runs.approved_by`/`approved_at` are nullable and only populated by the `approveStep` Action, giving a clean audit trail of who cleared a gate and when. Real Postgres enums (not text + check constraints) were used for `org_role`, `step_type`, `trigger_type`, `run_status`, `step_run_status` — Hasura introspects these directly into GraphQL enum types.

## How the two permission layers differ

**Layer 1** is declarative and lives entirely in Hasura's permission config (`nhost/metadata/databases/default/tables/*.yaml`). Every permission's `filter`/`check` reaches through a relationship to `org_members` and compares both `user_id` (from the verified JWT's `X-Hasura-User-Id` session variable) and `role`. This means org isolation is enforced by Postgres row filtering itself — it cannot be bypassed from the client, including by guessing a workflow or run ID, since the row simply doesn't match the filter for a user outside that org.

**Layer 2** is imperative and lives in the Action handler code (`web/src/app/api/*/route.ts`). Two sub-cases:
- Step-level gating for `db_write`/`notify`/`webhook` — enforced as a Hasura `insert_permissions.check` combining `org_members.role = owner` with the step/trigger type, so it's still declarative but scoped tighter than Layer 1's org-wide rule.
- The approval-gate resume decision is a genuine runtime check: `POST /api/approveStep` looks up the caller's `org_members.role` for the paused step's org and returns 403 if they're not `owner`/`editor`, *before* any database write happens. This has to be imperative because "may this specific person clear this specific paused run right now" isn't expressible as a static row permission — it's a decision made mid-execution, not a row read or write.

## Approval-gate pause/resume implementation

`triggerWorkflowRun` and `approveStep` share a single step-execution loop (`web/src/lib/server/executor.ts`, `runSteps(runId, steps, startIndex, initialOutput)`). When the loop encounters a step with `type: approval_gate`, it inserts a `step_runs` row with `status: paused`, sets the parent `workflow_runs.status` to `paused`, and returns immediately — nothing is left waiting in memory or blocked on a timer.

`approveStep` receives a `step_run_id`, verifies it's genuinely `paused`, checks the caller's role (Layer 2 above), then writes `approved_by`/`approved_at`/`status: success` onto that step_run, flips the `workflow_runs.status` back to `running`, looks up the step's `step_order`, and calls `runSteps` again starting at `step_order + 1`. This means resume is stateless — it re-derives everything it needs from the database rather than relying on any in-process state from the original `triggerWorkflowRun` call, which is what makes it safe to run in a serverless environment where the two calls may hit entirely different server instances.

The frontend subscribes to `step_runs` filtered by `workflow_run_id` via a GraphQL subscription over WebSocket, so the pause and the eventual resume are both reflected live with no polling or manual refresh.
