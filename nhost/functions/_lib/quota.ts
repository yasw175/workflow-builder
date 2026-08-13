import { hasuraRequest } from './hasura';

export async function checkAndGetQuota(orgId: string): Promise<{ used: number; allowed: number }> {
  const data = await hasuraRequest<{ organizations_by_pk: { quota_calls_used: number; quota_calls_allowed: number } }>(
    `query($orgId: uuid!) {
      organizations_by_pk(id: $orgId) {
        quota_calls_used
        quota_calls_allowed
      }
    }`,
    { orgId }
  );
  const org = data.organizations_by_pk;
  return { used: org.quota_calls_used, allowed: org.quota_calls_allowed };
}

export async function incrementQuota(orgId: string): Promise<void> {
  await hasuraRequest(
    `mutation($orgId: uuid!) {
      update_organizations_by_pk(pk_columns: { id: $orgId }, _inc: { quota_calls_used: 1 }) {
        id
      }
    }`,
    { orgId }
  );
}
