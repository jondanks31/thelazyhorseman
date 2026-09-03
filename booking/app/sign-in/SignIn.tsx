'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

export default function SignIn() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only ever a path on this host. Taking the query value as given
  // would turn a sign in link into an open redirect.
  const nextPath = (() => {
    const raw = params.get('next') ?? '/account';
    return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/account';
  })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // Deliberately the same answer whether the address is unknown or
      // the password is wrong, so this cannot be used to find out who
      // has an account.
      setError('That email and password do not match an account.');
      setBusy(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1 className="q">Sign in.</h1>
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
          id="password" type="password" autoComplete="current-password" required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}

      <div className="actions">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'One moment…' : 'Sign in'}
        </button>
      </div>

      <p className="field-hint">
        Not on a yard yet? <Link href="/start">Set one up</Link>.
      </p>
    </form>
  );
}
