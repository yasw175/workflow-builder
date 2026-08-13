import { gql } from '@apollo/client';

export const GET_MY_ORGS = gql`
  query GetMyOrgs {
    organizations {
      id
      name
      quota_calls_used
      quota_calls_allowed
      org_members {
        role
        user_id
      }
    }
  }
`;

export const GET_ORG_WORKFLOWS = gql`
  query GetOrgWorkflows($orgId: uuid!) {
    workflows(where: { org_id: { _eq: $orgId } }) {
      id
      name
      description
      workflow_steps(order_by: { step_order: asc }) {
        id
        step_order
        type
        name
        config
      }
      workflow_triggers {
        id
        type
        config
      }
      workflow_runs(order_by: { created_at: desc }, limit: 1) {
        id
        status
        created_at
      }
    }
  }
`;

export const GET_RUN_STEP_RUNS = gql`
  query GetRunStepRuns($runId: uuid!) {
    step_runs(where: { workflow_run_id: { _eq: $runId } }, order_by: { created_at: asc }) {
      id
      status
      output
      error
      approved_by
      workflow_step {
        id
        name
        type
      }
    }
  }
`;
