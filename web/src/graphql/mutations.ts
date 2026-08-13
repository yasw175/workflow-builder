import { gql } from '@apollo/client';

export const TRIGGER_WORKFLOW_RUN = gql`
  mutation TriggerWorkflowRun($workflowId: uuid!) {
    triggerWorkflowRun(workflow_id: $workflowId) {
      workflow_run_id
      status
    }
  }
`;

export const APPROVE_STEP = gql`
  mutation ApproveStep($stepRunId: uuid!) {
    approveStep(step_run_id: $stepRunId) {
      step_run_id
      status
    }
  }
`;

export const CREATE_WORKFLOW = gql`
  mutation CreateWorkflow($orgId: uuid!, $name: String!, $description: String) {
    insert_workflows_one(object: { org_id: $orgId, name: $name, description: $description }) {
      id
    }
  }
`;

export const ADD_WORKFLOW_STEP = gql`
  mutation AddWorkflowStep($workflowId: uuid!, $stepOrder: Int!, $type: step_type!, $name: String!, $config: jsonb!) {
    insert_workflow_steps_one(object: { workflow_id: $workflowId, step_order: $stepOrder, type: $type, name: $name, config: $config }) {
      id
    }
  }
`;
