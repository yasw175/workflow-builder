import { NextRequest, NextResponse } from 'next/server';
import { hasuraRequest } from '@/lib/server/hasura';
import { checkAndGetQuota, incrementQuota } from '@/lib/server/quota';
import { runSteps } from '@/lib/server/executor';

const WEBHOOK_SECRET = process.env.WORKFLOW_WEBHOOK_SECRET || 'demo-webhook-secret';

export async function POST(req: NextRequest) {
  try {
    const providedSecret = req.headers.get('x-webhook-secret');
    if (providedSecret !== WEBHOOK_SECRET) {
      return NextResponse.json({ message: 'Invalid webhook secret' }, { status: 401 });
    }

    const body = await req.json();
    const workflowId = body?.workflow_id;
    if (!workflowId) return NextResponse.json({ message: 'workflow_id is required' }, { status: 400 });

    const wfData = await hasuraRequest<{ workflows_by_pk: { org_id: string } | null }>(
      `query($id: uuid!) { workflows_by_pk(id: $id) { org_id } }`,
      { id: workflowId }
    );
    const workflow = wfData.workflows_by_pk;
    if (!workflow) return NextResponse.json({ message: 'Workflow not found' }, { status: 404 });
    const orgId = workflow.org_id;

    const quota = await checkAndGetQuota(orgId);
    if (quota.used >= quota.allowed) {
      return NextResponse.json({ message: 'Organization quota exhausted' }, { status: 403 });
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

    return NextResponse.json({ workflow_run_id: runId, status: result.status });
  } catch (e: any) {
    console.error('webhookTrigger error:', e);
    return NextResponse.json({ message: e.message || 'Internal error' }, { status: 500 });
  }
}
