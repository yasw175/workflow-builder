import { hasuraRequest } from './hasura';

export function getCallerUserId(req: any): string | null {
  // forward_client_headers: true means Hasura passes this through on Action calls
  return req.body?.session_variables?.['x-hasura-user-id'] || null;
}

export async function getOrgRole(userId: string, orgId: string): Promise<string | null> {
  const data = await hasuraRequest<{ org_members: { role: string }[] }>(
    `query($userId: uuid!, $orgId: uuid!) {
      org_members(where: { user_id: { _eq: $userId }, org_id: { _eq: $orgId } }) {
        role
      }
    }`,
    { userId, orgId }
  );
  return data.org_members[0]?.role ?? null;
}
