import { Request, Response } from 'express';
import { hasuraRequest } from './_lib/hasura';
import { getCallerUserId, getOrgRole } from './_lib/auth';
import { incrementQuota } from './_lib/quota';
import { runSteps } from './_lib/executor';

export default async function handler(req: Request, res: Response) {
  try {
    const stepRunId = req.body?.input?.step_run_id;
    const callerId = getCallerUserId(req);

    if (!callerId) return res.status(401).json({ message: 'Unauthorized' });
    if (!stepRunId) return res.status(400).json({ message: 'step_run_id is required' });

    // Locate the paused step_run, its run, its workflow, and its org
    const data = await hasuraRequest<{
      step_runs_by_pk: {
        id: string;
        status: string;
        workflow_run: {
          id: string;
          workflow_id: string;
          workflow: { org_id: string };
        };
        workflow_step: { step_order: number };
      } | null;
    }>(
      `query($id: uuid!) {
        step_runs_by_pk(id: $id) {
          id
          status
          workflow_run { id workflow_id workflow { org_id } }
          workflow_step { step_order }
        }
      }`,
      { id: stepRunId }
    );

    const stepRun = data.step_runs_by_pk;
    if (!stepRun) return res.status(404).json({ message: 'Step run not found' });
    if (stepRun.status !== 'paused') {
      return res.status(400).json({ message: 'This step is not awaiting approval' });
    }

    const orgId = stepRun.workflow_run.workflow.org_id;

    // Layer 2 check — the approval-gate role check lives here, not in a DB permission
    const role = await getOrgRole(callerId, orgId);
    if (role !== 'owner' && role !== 'editor') {
      return res.status(403).json({ message: 'Only owners or editors can approve this step' });
    }

    // Mark the gate step approved
    await hasuraRequest(
      `mutation($stepRunId: uuid!, $callerId: uuid!) {
        update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: {
          status: success, approved_by: $callerId, approved_at: "now()", completed_at: "now()"
        }) { id }
      }`,
      { stepRunId, callerId }
    );

    const runId = stepRun.workflow_run.id;
    const workflowId = stepRun.workflow_run.workflow_id;

    await hasuraRequest(
      `mutation($runId: uuid!) {
        update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: running }) { id }
      }`,
      { runId }
    );

    // Fetch all steps again, resume right after the approved one
    const stepsData = await hasuraRequest<{ workflow_steps: any[] }>(
      `query($workflowId: uuid!) {
        workflow_steps(where: { workflow_id: { _eq: $workflowId } }, order_by: { step_order: asc }) {
          id type name config step_order
        }
      }`,
      { workflowId }
    );
    const steps = stepsData.workflow_steps;
    const resumeIndex = steps.findIndex((s) => s.step_order === stepRun.workflow_step.step_order) + 1;

    const result = await runSteps(runId, steps, resumeIndex, null);

    if (result.status === 'completed') {
      await incrementQuota(orgId);
    }

    return res.json({ step_run_id: stepRunId, status: result.status });
  } catch (e: any) {
    console.error('approveStep error:', e);
    return res.status(500).json({ message: e.message || 'Internal error' });
  }
}
