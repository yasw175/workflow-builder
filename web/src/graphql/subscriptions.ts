import { gql } from '@apollo/client';

export const STEP_RUNS_SUBSCRIPTION = gql`
  subscription StepRunsForRun($runId: uuid!) {
    step_runs(where: { workflow_run_id: { _eq: $runId } }, order_by: { created_at: asc }) {
      id
      status
      output
      error
      approved_by
      approved_at
      workflow_step {
        id
        name
        type
      }
    }
  }
`;
