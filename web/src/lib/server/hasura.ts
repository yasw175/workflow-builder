const HASURA_URL = process.env.HASURA_GRAPHQL_URL || 'https://local.hasura.local.nhost.run/v1/graphql';
const ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET || process.env.NHOST_ADMIN_SECRET || '';

export async function hasuraRequest<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const res = await fetch(HASURA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(`Hasura error: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}
