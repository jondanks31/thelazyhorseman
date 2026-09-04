'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase';

/**
 * Asking for a new password.
 *
 * One component, mounted on the platform host and on every yard, so
 * the link Supabase sends comes back to whichever address they started
 * from. That matters: sessions are host scoped, so resetting on
 * book.thelazyhorseman.com would leave a rider signed in somewhere
 * that is no use to them. Their yard's own link is the whole product.
 */
export default function ResetRequest({
  /** Where "back to signing in" goes on this host. */
  signInHref = '/sign-in',
}: {
  signInHref?: string;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error: sendError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/reset/confirm` },
    );

    setBusy(false);

    // Only a real fault is shown. An address with no account gets the
    // same answer as one that has, for the same reason sign in gives
    // one message for both halves: this must not become a way of
    // finding out who is on a yard.
    if (sendError && sendError.status !== 400) {
      setError('That did not work. Try again in a minute.');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <section className="card">
        <h1 className="q">Check your email.</h1>
        <p className="sub">
          If <strong>{email.trim().toLowerCase()}</strong> has an account, there is a
          link on its way. It works once, and it runs out after an hour.
        </p>
        <p className="field-hint">
          Nothing there? Look in junk, then{' '}
          <button type="button" className="link-button" onClick={() => setSent(false)}>
            try another address
          </button>
          .
        </p>
      </section>
    );
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1 className="q">Forgotten it?</h1>
      <p className="sub">Happens. Put your email in and we will send you a way back.</p>

      <div className="field">
        <label htmlFor="reset-email">Your email</label>
        <input
          id="reset-email" type="email" autoComplete="email" required value={email}
          placeholder="you@youryard.co.uk"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}

      <div className="actions">
        <button className="btn" type="submit" disabled={busy || !email.includes('@')}>
          {busy ? 'One moment…' : 'Send me a link'}
        </button>
      </div>

      <p className="field-hint">
        Remembered it? <Link href={signInHref}>Sign in</Link>.
      </p>
    </form>
  );
}
