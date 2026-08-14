import { hasuraRequest } from './hasura';
import { callLLM } from './llm';

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runSteps(
  runId: string,
  steps: any[],
  startIndex: number,
  initialOutput: any
): Promise<{ status: string }> {
  let lastOutput = initialOutput;

  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i];

    const stepRunData = await hasuraRequest<{ insert_step_runs_one: { id: string } }>(
      `mutation($runId: uuid!, $stepId: uuid!, $input: jsonb) {
        insert_step_runs_one(object: {
          workflow_run_id: $runId,
          workflow_step_id: $stepId,
          status: running,
          input: $input,
          attempt_count: 1,
          started_at: "now()"
        }) { id }
      }`,
      { runId, stepId: step.id, input: lastOutput }
    );
    const stepRunId = stepRunData.insert_step_runs_one.id;

    if (step.type === 'approval_gate') {
      await hasuraRequest(
        `mutation($stepRunId: uuid!) {
          update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: paused }) { id }
        }`,
        { stepRunId }
      );
      await hasuraRequest(
        `mutation($runId: uuid!) {
          update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: paused }) { id }
        }`,
        { runId }
      );
      return { status: 'paused' };
    }

    let output: any;
    let error: string | null = null;
    const maxAttempts = ['llm_call', 'http_request'].includes(step.type) ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (step.type === 'llm_call') {
          const prompt = step.config?.prompt || JSON.stringify(lastOutput ?? {});
          const llmResult = await callLLM(prompt);
          output = { text: llmResult.output };
        } else if (step.type === 'http_request') {
          const url = step.config?.url;
          const method = step.config?.method || 'GET';
          const r = await fetch(url, { method });
          output = { status: r.status, body: await r.text() };
        } else if (step.type === 'db_write') {
          output = { written: true, data: lastOutput };
        } else if (step.type === 'notify') {
          output = { notified: true, message: step.config?.message || 'Workflow notification' };
        } else if (step.type === 'conditional_branch') {
          const field = step.config?.field || 'text';
          const expected = step.config?.equals;
          const actual = lastOutput?.[field];
          output = { branch: actual === expected ? 'true' : 'false', actual };
        } else {
          output = { skipped: true };
        }
        error = null;
        break;
      } catch (e: any) {
        error = e.message;
        if (attempt < maxAttempts) await sleep(500);
      }
    }

    const finalStatus = error ? 'failed' : 'success';
    await hasuraRequest(
      `mutation($stepRunId: uuid!, $status: step_run_status!, $output: jsonb, $error: String) {
        update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: {
          status: $status, output: $output, error: $error, completed_at: "now()"
        }) { id }
      }`,
      { stepRunId, status: finalStatus, output: output ?? null, error }
    );

    if (error) {
      await hasuraRequest(
        `mutation($runId: uuid!) {
          update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: failed, completed_at: "now()" }) { id }
        }`,
        { runId }
      );
      return { status: 'failed' };
    }

    lastOutput = output;
  }

  await hasuraRequest(
    `mutation($runId: uuid!) {
      update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: completed, completed_at: "now()" }) { id }
    }`,
    { runId }
  );
  return { status: 'completed' };
}
