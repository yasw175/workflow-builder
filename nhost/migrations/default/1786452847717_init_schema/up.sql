-- Enums
create type org_role as enum ('owner', 'editor', 'viewer');
create type step_type as enum ('llm_call', 'http_request', 'db_write', 'notify', 'conditional_branch', 'approval_gate');
create type trigger_type as enum ('manual', 'webhook', 'scheduled', 'database_event');
create type run_status as enum ('pending', 'running', 'paused', 'completed', 'failed');
create type step_run_status as enum ('pending', 'running', 'success', 'failed', 'paused');

-- Organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quota_calls_allowed integer not null default 500,
  quota_calls_used integer not null default 0,
  quota_period_start timestamptz not null default date_trunc('month', now()),
  created_at timestamptz not null default now()
);

-- Org membership (join table: user <-> org, with role)
create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role org_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index idx_org_members_org on org_members(org_id);
create index idx_org_members_user on org_members(user_id);

-- Workflows
create table workflows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_workflows_org on workflows(org_id);

-- Workflow steps (ordered)
create table workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  step_order integer not null,
  type step_type not null,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workflow_id, step_order)
);
create index idx_workflow_steps_workflow on workflow_steps(workflow_id);

-- Workflow triggers
create table workflow_triggers (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  type trigger_type not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_workflow_triggers_workflow on workflow_triggers(workflow_id);

-- Workflow runs (one per execution)
create table workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  status run_status not null default 'pending',
  trigger_type trigger_type not null default 'manual',
  triggered_by uuid references auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_workflow_runs_workflow on workflow_runs(workflow_id);
create index idx_workflow_runs_status on workflow_runs(status);

-- Step runs (one per step per run)
create table step_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references workflow_runs(id) on delete cascade,
  workflow_step_id uuid not null references workflow_steps(id) on delete cascade,
  status step_run_status not null default 'pending',
  input jsonb,
  output jsonb,
  error text,
  attempt_count integer not null default 0,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_step_runs_run on step_runs(workflow_run_id);
create index idx_step_runs_step on step_runs(workflow_step_id);
