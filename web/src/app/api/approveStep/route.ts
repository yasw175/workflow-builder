import { NextRequest, NextResponse } from 'next/server';
import { hasuraRequest } from '@/lib/server/hasura';
import { getCallerUserId, getOrgRole } from '@/lib/server/auth';
import { incrementQuota } from '@/lib/server/quota';
import { runSteps } from '@/lib/server/executor';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const stepRunId = body?.input?.step_run_id;
    const callerId = getCallerUserId(body);

    if (!callerId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (!stepRunId) return NextResponse.json({ message: 'step_run_id is required' }, { status: 400 });

    const data = await hasuraRequest<{
      step_runs_by_pk: {
        id: string;
        status: string;
        workflow_run: { id: string; workflow_id: string; workflow: { org_id: string } };
        workflow_step: { step_order: number };
      } | null;
    }>(
      `query($id: uuid!) {
        step_runs_by_pk(id: $id) {
          id status
          workflow_run { id workflow_id workflow { org_id } }
          workflow_step { step_order }
        }
      }`,
      { id: stepRunId }
    );

    const stepRun = data.step_runs_by_pk;
    if (!stepRun) return NextResponse.json({ message: 'Step run not found' }, { status: 404 });
    if (stepRun.status !== 'paused') {
      return NextResponse.json({ message: 'This step is not awaiting approval' }, { status: 400 });
    }

    const orgId = stepRun.workflow_run.workflow.org_id;

    const role = await getOrgRole(callerId, orgId);
    if (role !== 'owner' && role !== 'editor') {
      return NextResponse.json({ message: 'Only owners or editors can approve this step' }, { status: 403 });
    }

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
    if (result.status === 'completed') await incrementQuota(orgId);

    return NextResponse.json({ step_run_id: stepRunId, status: result.status });
  } catch (e: any) {
    console.error('approveStep error:', e);
    return NextResponse.json({ message: e.message || 'Internal error' }, { status: 500 });
  }
}
