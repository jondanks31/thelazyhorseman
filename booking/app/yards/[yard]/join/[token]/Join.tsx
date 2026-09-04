'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

type Mode = 'new' | 'existing';

export default function Join({ yardName, token }: { yardName: string; token: string }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('new');
  const [fullName, setFullName] = useState('');
  const [horse, setHorse] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  // Somebody already signed in on this yard only needs the join doing.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) join();
      else setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function join() {
    const { error: joinError } = await supabase.rpc('join_yard', { p_token: token });
    if (joinError) {
      setBusy(false);
      setReady(true);
      setError(
        joinError.code === 'PT404'
          ? 'That link has been used or is no longer good. Ask the yard for another.'
          : joinError.message,
      );
      return;
    }
    router.replace('/');
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    if (mode === 'existing') {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError('That email and password do not match an account.');
        setBusy(false);
        return;
      }
      await join();
      return;
    }

    // Carried as user metadata, because signUp happens before there is
    // a session to write a profile row with. Migration 0016 copies it.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: fullName.trim(), horse_name: horse.trim() },
        // Back to this invite, so confirming finishes the join instead
        // of dropping them on the platform's front door holding a token
        // they can no longer reach.
        emailRedirectTo: window.location.href,
      },
    });

    // signUp returns a user with no session both when confirmation is
    // pending and when the address is already registered, and gives no
    // error for the second so signup cannot be used to find accounts.
    // A sign in attempt is the only way to tell them apart.
    if (data?.session) {
      await join();
      return;
    }

    const { data: signIn } = await supabase.auth.signInWithPassword({ email, password });
    if (signIn?.session) {
      await join();
      return;
    }

    setBusy(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setConfirm(true);
  }

  if (!ready) {
    return (
      <section className="card">
        <h1 className="q">One moment.</h1>
      </section>
    );
  }

  if (confirm) {
    return (
      <section className="card">
        <h1 className="q">Check your email.</h1>
        <p className="sub">
          We have sent a link to <strong>{email}</strong>. Open it, then come back
          to this page.
        </p>
      </section>
    );
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1 className="q">Join {yardName}.</h1>

      <div className="choices" role="group" aria-label="Do you have an account">
        <button
          type="button" className="choice" aria-pressed={mode === 'new'}
          onClick={() => { setMode('new'); setError(null); }}
        >
          I am new
        </button>
        <button
          type="button" className="choice" aria-pressed={mode === 'existing'}
          onClick={() => { setMode('existing'); setError(null); }}
        >
          I have an account
        </button>
      </div>

      {/* Only asked of somebody new. Anybody signing in already has a
          name on their account and should not be typing it twice. */}
      {mode === 'new' && (
        <>
          <div className="field">
            <label htmlFor="join-name">Your name</label>
            <input
              id="join-name" type="text" autoComplete="name" required value={fullName}
              placeholder="Sarah Bell"
              onChange={(e) => setFullName(e.target.value)}
            />
            <p className="field-hint">So the yard knows who has the arena.</p>
          </div>

          <div className="field">
            <label htmlFor="join-horse">Your horse</label>
            <input
              id="join-horse" type="text" value={horse}
              placeholder="Bramble"
              onChange={(e) => setHorse(e.target.value)}
            />
          </div>
        </>
      )}

      <div className="field">
        <label htmlFor="join-email">Your email</label>
        <input
          id="join-email" type="email" autoComplete="email" required value={email}
          placeholder="you@example.com"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="join-password">
          {mode === 'new' ? 'Pick a password' : 'Password'}
        </label>
        <input
          id="join-password" type="password" required value={password}
          minLength={mode === 'new' ? 8 : undefined}
          autoComplete={mode === 'new' ? 'new-password' : 'current-password'}
          placeholder={mode === 'new' ? 'At least eight characters' : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}

      {/* Only for somebody making an account. A rider signing in already
          agreed to this the first time. */}
      {mode === 'new' && (
        <p className="field-hint">
          Joining means agreeing to the{' '}
          <a href="https://www.thelazyhorseman.com/terms">terms</a> and the{' '}
          <a href="https://www.thelazyhorseman.com/privacy">privacy policy</a>.
        </p>
      )}

      <div className="actions">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'One moment…' : 'Join'}
        </button>
      </div>

      {/* Somebody coming back to a second yard is the likeliest person
          in the whole product to have forgotten their password. */}
      {mode === 'existing' && (
        <p className="field-hint">
          <Link href="/reset">Forgotten your password?</Link>
        </p>
      )}
    </form>
  );
}
