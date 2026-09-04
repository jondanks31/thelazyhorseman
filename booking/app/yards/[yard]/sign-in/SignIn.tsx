'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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

  // Back to the yard's front door by default, which works out whether
  // this is a rider or somebody who runs the place. Guessing here would
  // mean two answers to the same question, drifting apart.
  //
  // Only ever a path on this yard: taking the value straight from the
  // query string would let a link push somebody to any site after a
  // successful sign in.
  const nextPath = (() => {
    const raw = params.get('next') ?? '/';
    return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
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

      {/* Resetting happens on this yard's own address, so they come back
          signed in here rather than on the front door, which is no use
          to a rider. */}
      <p className="field-hint">
        <Link href="/reset">Forgotten your password?</Link>
      </p>
    </form>
  );
}
