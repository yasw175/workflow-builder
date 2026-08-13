import { Request, Response } from 'express';
import { hasuraRequest } from './_lib/hasura';
import { checkAndGetQuota, incrementQuota } from './_lib/quota';
import { runSteps } from './_lib/executor';

const WEBHOOK_SECRET = process.env.WORKFLOW_WEBHOOK_SECRET || 'demo-webhook-secret';

export default async function handler(req: Request, res: Response) {
  try {
    const providedSecret = req.headers['x-webhook-secret'];
    if (providedSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ message: 'Invalid webhook secret' });
    }

    const workflowId = req.body?.workflow_id;
    if (!workflowId) return res.status(400).json({ message: 'workflow_id is required' });

    const wfData = await hasuraRequest<{ workflows_by_pk: { org_id: string } | null }>(
      `query($id: uuid!) { workflows_by_pk(id: $id) { org_id } }`,
      { id: workflowId }
    );
    const workflow = wfData.workflows_by_pk;
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });
    const orgId = workflow.org_id;

    const quota = await checkAndGetQuota(orgId);
    if (quota.used >= quota.allowed) {
      return res.status(403).json({ message: 'Organization quota exhausted' });
    }

    const runData = await hasuraRequest<{ insert_workflow_runs_one: { id: string } }>(
      `mutation($workflowId: uuid!) {
        insert_workflow_runs_one(object: {
          workflow_id: $workflowId, status: running, trigger_type: webhook, started_at: "now()"
        }) { id }
      }`,
      { workflowId }
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
    if (result.status === 'completed') await incrementQuota(orgId);

    return res.json({ workflow_run_id: runId, status: result.status });
  } catch (e: any) {
    console.error('webhookTrigger error:', e);
    return res.status(500).json({ message: e.message || 'Internal error' });
  }
}
