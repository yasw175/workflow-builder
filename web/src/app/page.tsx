'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { nhost } from '@/lib/nhost';
import { GET_MY_ORGS, GET_ORG_WORKFLOWS } from '@/graphql/queries';
import { TRIGGER_WORKFLOW_RUN } from '@/graphql/mutations';

export default function HomePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = nhost.auth.onAuthStateChanged((event, session) => {
      setAuthed(!!session);
      setUserId(session?.user?.id ?? null);
      if (!session) router.push('/sign-in');
    });
    return () => unsub.unsubscribe?.();
  }, [router]);

  const { data: orgData, loading: orgLoading } = useQuery(GET_MY_ORGS, { skip: !authed });
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (orgData?.organizations?.[0] && !selectedOrgId) {
      setSelectedOrgId(orgData.organizations[0].id);
    }
  }, [orgData, selectedOrgId]);

  const { data: wfData, loading: wfLoading } = useQuery(GET_ORG_WORKFLOWS, {
    variables: { orgId: selectedOrgId },
    skip: !selectedOrgId,
  });

  const [triggerRun, { loading: triggering }] = useMutation(TRIGGER_WORKFLOW_RUN);

  const myRole = orgData?.organizations
    ?.find((o: any) => o.id === selectedOrgId)
    ?.org_members?.find((m: any) => m.user_id === userId)?.role;

  const canTrigger = myRole === 'owner' || myRole === 'editor';

  async function handleRun(workflowId: string) {
    const result = await triggerRun({ variables: { workflowId } });
    const runId = result.data?.triggerWorkflowRun?.workflow_run_id;
    if (runId) router.push(`/run/${runId}`);
  }

  if (authed === null || orgLoading) return <div style={{ padding: 40 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20 }}>Your organizations</h1>
        <button onClick={() => nhost.auth.signOut().then(() => router.push('/sign-in'))} style={{ fontSize: 12, color: '#8A93A6' }}>
          Sign out
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {orgData?.organizations?.map((org: any) => (
          <button
            key={org.id}
            onClick={() => setSelectedOrgId(org.id)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #2A2F3B',
              background: selectedOrgId === org.id ? '#20242F' : 'transparent',
              color: '#EDEFF3',
            }}
          >
            {org.name} ({org.quota_calls_used}/{org.quota_calls_allowed})
          </button>
        ))}
      </div>

      {wfLoading && <div>Loading workflows…</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {wfData?.workflows?.map((wf: any) => (
          <div key={wf.id} style={{ padding: 16, border: '1px solid #2A2F3B', borderRadius: 8, background: '#1A1E27' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{wf.name}</div>
                <div style={{ fontSize: 12, color: '#8A93A6' }}>
                  {wf.workflow_steps.length} steps · last run: {wf.workflow_runs[0]?.status ?? 'never'}
                </div>
              </div>
              {canTrigger ? (
                <button
                  onClick={() => handleRun(wf.id)}
                  disabled={triggering}
                  style={{ padding: '6px 14px', background: '#F0A63A', color: '#12151B', border: 'none', borderRadius: 6, fontWeight: 600 }}
                >
                  {triggering ? 'Running…' : 'Run'}
                </button>
              ) : (
                <span style={{ fontSize: 12, color: '#8A93A6' }}>view only</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
