'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { nhost } from '@/lib/nhost';

export default function SignInPage() {
  const [email, setEmail] = useState('orga-owner@demo.test');
  const [password, setPassword] = useState('DemoPass123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await nhost.auth.signIn({ email, password });
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    router.push('/');
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 20, marginBottom: 20 }}>Sign in</h1>
      <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={{ padding: 8, background: '#1A1E27', border: '1px solid #2A2F3B', color: '#EDEFF3', borderRadius: 6 }}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          style={{ padding: 8, background: '#1A1E27', border: '1px solid #2A2F3B', color: '#EDEFF3', borderRadius: 6 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: 10, background: '#F0A63A', color: '#12151B', border: 'none', borderRadius: 6, fontWeight: 600 }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <div style={{ color: '#F0576C', fontSize: 13 }}>{error}</div>}
      </form>
      <p style={{ marginTop: 16, fontSize: 12, color: '#8A93A6' }}>
        Demo accounts: orga-owner@demo.test / orga-editor@demo.test / orgb-owner@demo.test / orgb-viewer@demo.test — all use DemoPass123!
      </p>
    </div>
  );
}
