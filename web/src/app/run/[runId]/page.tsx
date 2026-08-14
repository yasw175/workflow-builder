'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSubscription, useMutation } from '@apollo/client';
import { nhost } from '@/lib/nhost';
import { STEP_RUNS_SUBSCRIPTION } from '@/graphql/subscriptions';
import { APPROVE_STEP } from '@/graphql/mutations';

const STATUS_COLOR: Record<string, string> = {
  pending: '#8A93A6',
  running: '#F0A63A',
  success: '#3ED68C',
  failed: '#F0576C',
  paused: '#F0576C',
};

export default function RunPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = nhost.auth.onAuthStateChanged((event, session) => {
      setAuthed(!!session);
      setUserId(session?.user?.id ?? null);
      if (!session) router.push('/sign-in');
    });
    return () => unsubscribe();
  }, [router]);

  const { data, loading } = useSubscription(STEP_RUNS_SUBSCRIPTION, {
    variables: { runId },
    skip: !authed,
  });

  const [approveStep, { loading: approving }] = useMutation(APPROVE_STEP);

  if (authed === null || loading) return <div style={{ padding: 40, color: '#EDEFF3' }}>Connecting…</div>;

  const stepRuns = data?.step_runs ?? [];
  const pausedStep = stepRuns.find((s: any) => s.status === 'paused');

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'system-ui', color: '#EDEFF3' }}>
      <button onClick={() => router.push('/')} style={{ fontSize: 12, color: '#8A93A6', marginBottom: 16 }}>
        ← back
      </button>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Run status</h1>
      <div style={{ fontSize: 12, color: '#8A93A6', marginBottom: 20 }}>Live via subscription — no refresh needed</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {stepRuns.map((sr: any) => (
          <div
            key={sr.id}
            style={{
              padding: 14,
              border: `1px solid ${STATUS_COLOR[sr.status] || '#2A2F3B'}44`,
              borderRadius: 8,
              background: '#1A1E27',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{sr.workflow_step.name}</div>
                <div style={{ fontSize: 12, color: '#8A93A6' }}>{sr.workflow_step.type}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLOR[sr.status] || '#8A93A6' }}>
                {sr.status}
              </span>
            </div>
            {sr.output && (
              <pre style={{ fontSize: 11, color: '#8A93A6', marginTop: 8, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(sr.output, null, 2)}
              </pre>
            )}
            {sr.error && <div style={{ fontSize: 12, color: '#F0576C', marginTop: 8 }}>{sr.error}</div>}
          </div>
        ))}
      </div>

      {pausedStep && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            border: '1px solid #F0576C66',
            borderRadius: 8,
            background: '#F0576C14',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 13 }}>
            Paused at <b>{pausedStep.workflow_step.name}</b> — awaiting approval
          </span>
          <button
            onClick={() => approveStep({ variables: { stepRunId: pausedStep.id } })}
            disabled={approving}
            style={{ padding: '6px 14px', background: '#3ED68C', color: '#12151B', border: 'none', borderRadius: 6, fontWeight: 600 }}
          >
            {approving ? 'Approving…' : 'Approve'}
          </button>
        </div>
      )}
    </div>
  );
}
