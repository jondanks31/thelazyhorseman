'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

export default function SignIn({ yardName }: { yardName: string }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only ever follow a path on this yard. Taking the value straight
  // from the query string would let a link push somebody to any site
  // after a successful sign in.
  const nextPath = (() => {
    const raw = params.get('next') ?? '/admin';
    return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/admin';
  })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError('That email and password do not match an account here.');
      setBusy(false);
      return;
    }
    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1 className="q">Sign in to {yardName}.</h1>
      <div className="field">
        <label htmlFor="email">Your email</label>
        <input
          id="email" type="email" autoComplete="email" required value={email}
          placeholder="you@youryard.co.uk"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password" type="password" autoComplete="current-password" required value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}

      <div className="actions">
        <button className="btn" type="submit" disabled={busy || !email || !password}>
          {busy ? 'One moment…' : 'Sign in'}
        </button>
      </div>
    </form>
  );
}
