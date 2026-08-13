import { Request, Response } from 'express';
import { hasuraRequest } from './_lib/hasura';
import { getCallerUserId, getOrgRole } from './_lib/auth';
import { checkAndGetQuota, incrementQuota } from './_lib/quota';
import { runSteps } from './_lib/executor';

export default async function handler(req: Request, res: Response) {
  try {
    const workflowId = req.body?.input?.workflow_id;
    const callerId = getCallerUserId(req);

    if (!callerId) return res.status(401).json({ message: 'Unauthorized' });
    if (!workflowId) return res.status(400).json({ message: 'workflow_id is required' });

    const wfData = await hasuraRequest<{ workflows_by_pk: { org_id: string } | null }>(
      `query($id: uuid!) { workflows_by_pk(id: $id) { org_id } }`,
      { id: workflowId }
    );
    const workflow = wfData.workflows_by_pk;
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });
    const orgId = workflow.org_id;

    const role = await getOrgRole(callerId, orgId);
    if (role !== 'owner' && role !== 'editor') {
      return res.status(403).json({ message: 'Only owners or editors can trigger a run' });
    }

    const quota = await checkAndGetQuota(orgId);
    if (quota.used >= quota.allowed) {
      return res.status(403).json({ message: 'Organization quota exhausted' });
    }

    const runData = await hasuraRequest<{ insert_workflow_runs_one: { id: string } }>(
      `mutation($workflowId: uuid!, $callerId: uuid!) {
        insert_workflow_runs_one(object: {
          workflow_id: $workflowId, status: running, trigger_type: manual,
          triggered_by: $callerId, started_at: "now()"
        }) { id }
      }`,
      { workflowId, callerId }
    );
    const runId = runData.insert_workflow_runs_one.id;

    const stepsData = await hasuraRequest<{ workflow_steps: any[] }>(
      `query($workflowId: uuid!) {
        workflow_steps(where: { workflow_id: { _eq: $workflowId } }, order_by: { step_order: asc }) {
          id type name config
        }
      }`,
      { workflowId }
    );

    const result = await runSteps(runId, stepsData.workflow_steps, 0, null);

    if (result.status === 'completed') {
      await incrementQuota(orgId);
    }

    return res.json({ workflow_run_id: runId, status: result.status });
  } catch (e: any) {
    console.error('triggerWorkflowRun error:', e);
    return res.status(500).json({ message: e.message || 'Internal error' });
  }
}
