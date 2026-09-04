'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

type Ready = 'waiting' | 'ok' | 'expired';

/**
 * Setting the new password, after following the link in the email.
 *
 * The link lands here carrying a recovery token, which the Supabase
 * client trades for a session on its own. That happens asynchronously
 * and there is no single call that says "is it done yet", so this
 * subscribes and also asks once, and only calls the link dead after
 * giving both a moment to answer. Deciding too early would tell
 * somebody with a perfectly good link to go and ask for another.
 */
export default function ResetConfirm({
  /** Where they land once the password is changed. */
  doneHref,
  signInHref = '/sign-in',
}: {
  doneHref: string;
  signInHref?: string;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [ready, setReady] = useState<Ready>('waiting');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let settled = false;
    const arrived = () => {
      settled = true;
      setReady('ok');
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) arrived();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) arrived();
    });

    const timer = setTimeout(() => {
      if (!settled) setReady('expired');
    }, 5000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error: writeError } = await supabase.auth.updateUser({ password });

    if (writeError) {
      setBusy(false);
      setError(writeError.message);
      return;
    }

    // Changing it signs them in on this host, which is the point of
    // resetting on the yard's own address rather than the front door.
    router.replace(doneHref);
    router.refresh();
  }

  if (ready === 'waiting') {
    return (
      <section className="card">
        <h1 className="q">One moment.</h1>
      </section>
    );
  }

  if (ready === 'expired') {
    return (
      <section className="card">
        <h1 className="q">That link has gone.</h1>
        <div className="actions">
          <Link className="btn" href="/reset">Send another</Link>
        </div>
      </section>
    );
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1 className="q">Pick a new password.</h1>
      <div className="field">
        <label htmlFor="new-password">New password</label>
        <div className="pw-row">
          <input
            id="new-password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={password}
            placeholder="At least eight characters"
            onChange={(e) => setPassword(e.target.value)}
          />
          {/* Typing a password you cannot see, on a phone, in a barn.
              The toggle is worth more here than the shoulder surfing
              it costs. */}
          <button
            type="button"
            className="pw-reveal"
            aria-pressed={show}
            onClick={() => setShow((was) => !was)}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="field-hint">Eight characters or more. Nothing clever required.</p>
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}

      <div className="actions">
        <button className="btn" type="submit" disabled={busy || password.length < 8}>
          {busy ? 'Saving…' : 'Save it and go in'}
        </button>
      </div>

      <p className="field-hint">
        <Link href={signInHref}>Sign in</Link> with the old one instead.
      </p>
    </form>
  );
}
