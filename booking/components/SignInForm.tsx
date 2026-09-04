'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

/**
 * Signing in, once.
 *
 * There were two of these, on the front door and on every yard, with
 * the same fields, the same call and two slightly different sentences
 * for the same failure. Adding "Forgotten your password?" meant doing
 * it twice, which is how a thing like that ends up on one of them.
 *
 * The join page keeps its own, because it is a join with a sign in
 * inside it rather than a sign in: it carries the name and horse
 * fields, and finishes by calling join_yard() instead of navigating.
 */
export default function SignInForm({
  heading,
  /** Where to go when no ?next= says otherwise. */
  fallback,
  footer,
}: {
  heading: string;
  fallback: string;
  footer?: React.ReactNode;
}) {
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
    const raw = params.get('next') ?? fallback;
    return raw.startsWith('/') && !raw.startsWith('//') ? raw : fallback;
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
      <h1 className="q">{heading}</h1>

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
        <button className="btn" type="submit" disabled={busy || !email || !password}>
          {busy ? 'One moment…' : 'Sign in'}
        </button>
      </div>

      {/* Resetting happens on whichever address they came in on, so a
          rider lands back on their own yard rather than the front door. */}
      <p className="field-hint">
        <Link href="/reset">Forgotten your password?</Link>
      </p>

      {footer}
    </form>
  );
}
