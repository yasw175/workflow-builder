export type OrgRole = 'owner' | 'editor' | 'viewer';
export type StepType = 'llm_call' | 'http_request' | 'db_write' | 'notify' | 'conditional_branch' | 'approval_gate';
export type TriggerType = 'manual' | 'webhook' | 'scheduled' | 'database_event';
export type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';
export type StepRunStatus = 'pending' | 'running' | 'success' | 'failed' | 'paused';

export interface Organization {
  id: string;
  name: string;
  quota_calls_used: number;
  quota_calls_allowed: number;
}

export interface WorkflowStep {
  id: string;
  step_order: number;
  type: StepType;
  name: string;
  config: Record<string, any>;
}

export interface WorkflowTrigger {
  id: string;
  type: TriggerType;
  config: Record<string, any>;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  workflow_steps: WorkflowStep[];
  workflow_triggers: WorkflowTrigger[];
}

export interface StepRun {
  id: string;
  status: StepRunStatus;
  output: any;
  error: string | null;
  approved_by: string | null;
  workflow_step: { id: string; name: string; type: StepType };
}
